"use client";

/**
 * The one seam between a real trade and a hypothetical one.
 *
 * Everything above this file — the round, the ladder, every game screen — runs
 * identically in both modes. Demo and live differ by **one swapped object** and
 * nothing else, which is the only structure that stops a demo drifting into a
 * second, divergent implementation of the product.
 *
 * The paper side is deliberately unflattering. A fill is priced by walking the
 * *actual* live book, level by level, exactly as an IOC would have: it pays the
 * real depth's prices, it partially fills when the depth runs out, and it fails
 * with `noLiquidity` when nobody is there — which on this venue is a normal
 * outcome, not an error. Settlement is not simulated at all; a paper position
 * wins or loses on the same oracle result as a funded one.
 */

import * as book from "./book";
import * as orders from "./orders";
import * as positions from "./positions";
import * as redeem from "./redeem";
import * as wallet from "./wallet";
import * as demo from "@/lib/demo";
import * as markets from "./markets";
import { COLLATERAL } from "./config";
import type { Window } from "./markets";
import type { Position } from "./portfolio";

export type Side = orders.Side;
export type OrderOutcome = orders.OrderOutcome & { orderId?: bigint };

const ONE = BigInt(10 ** COLLATERAL.decimals);
const raw = (n: number) => BigInt(Math.round(n * Number(ONE)));

export interface Executor {
  /** True when fills are hypothetical. Screens must say so when it is. */
  readonly paper: boolean;
  balance(): bigint;
  ready(): void;
  refresh(): Promise<void>;
  preApprove(pool: string): Promise<void>;
  buy(w: Window, side: Side, yesPrice: bigint, size: bigint): Promise<OrderOutcome>;
  sell(w: Window, side: Side, yesPrice: bigint, size: bigint): Promise<OrderOutcome>;
  rest(
    w: Window,
    side: Side,
    yesPrice: bigint,
    size: bigint,
    options?: orders.RestOptions,
  ): Promise<OrderOutcome>;
  /** Positions only. A read, with no side effects. */
  holding(w: Window): Promise<{ up: bigint; down: bigint }>;
  /**
   * Advance a resting bid: fill it if the market has come to it, or release it
   * if its window has closed. On chain both happen by themselves, so this is a
   * no-op there; in paper it is the only thing that moves them.
   */
  pumpResting(w: Window): Promise<void>;
  /** Collect a settled position. Returns what it paid. */
  claim(p: Position): Promise<{ ok: boolean; paid: bigint; error?: string }>;
}

// ── The real one ────────────────────────────────────────────────────────────

const chain: Executor = {
  paper: false,
  balance: () => wallet.getSnapshot().collateral,
  ready: () => void wallet.ensureWallet(),
  refresh: () => wallet.refresh(),
  preApprove: (pool) => orders.preApprove(pool),
  buy: (w, side, yesPrice, size) => orders.buy(w, side, yesPrice, size),
  sell: (w, side, yesPrice, size) => orders.sell(w, side, yesPrice, size),
  rest: (w, side, yesPrice, size, options) => orders.rest(w, side, yesPrice, size, options),
  holding: (w) => positions.readHolding(w),
  pumpResting: async () => {},
  async claim(p) {
    const result = await redeem.redeem(p);
    await wallet.refresh();
    return { ok: result.ok, paid: result.ok ? p.redeemable : 0n, error: result.error };
  },
};

// ── The hypothetical one ────────────────────────────────────────────────────

/**
 * Walk a ladder the way a marketable order would, and report what it would
 * really have cost.
 *
 * Levels are in the side's own terms, best first. Anything priced worse than
 * the limit is not touched, and running out of depth means a partial fill —
 * both of which the real venue does too.
 */
function sweep(levels: book.Level[], limit: number, want: number) {
  let filled = 0;
  let spent = 0;
  for (const level of levels) {
    if (filled >= want) break;
    if (level.price > limit) break;
    const take = Math.min(level.size, want - filled);
    filled += take;
    spent += take * level.price;
  }
  return { filled, spent, average: filled > 0 ? spent / filled : 0 };
}

/** The ladder a buyer of `side` would be lifting. */
const asksFor = (b: book.Book, side: Side) => (side === "up" ? b.yesAsks : b.noAsks);
/** The ladder a seller of `side` would be hitting. */
const bidsFor = (b: book.Book, side: Side) => (side === "up" ? b.yesBids : b.noBids);

/** A limit expressed in the side's own terms — `yesPrice` is always YES terms. */
const ownTerms = (side: Side, yesPrice: bigint) =>
  side === "up" ? Number(yesPrice) / Number(ONE) : 1 - Number(yesPrice) / Number(ONE);

/** Markets currently being advanced, so overlapping polls cannot double-fill. */
const pumping = new Set<string>();

const paper: Executor = {
  paper: true,
  balance: () => demo.getBalance(),
  ready: () => demo.hydrate(),
  refresh: async () => {},
  preApprove: async () => {},

  async buy(w, side, yesPrice, size) {
    const b = await book.readBook(w.poolAddress);
    const want = Number(size) / Number(ONE);
    const { filled, spent, average } = sweep(asksFor(b, side), ownTerms(side, yesPrice), want);
    if (filled <= 0) return { ok: false, filled: 0n, noLiquidity: true };

    const cost = raw(spent);
    if (cost > demo.getBalance()) {
      return { ok: false, filled: 0n, error: "Not enough in the demo balance" };
    }
    demo.fill(w.marketId, side, cost, raw(filled));
    return { ok: true, filled: raw(filled), fillPrice: raw(side === "up" ? average : 1 - average) };
  },

  async sell(w, side, yesPrice, size) {
    // The book has depth for far more than the paper position, so the sell is
    // sized against what is actually held. The ledger is the only record of it.
    const have = demo.held(w.marketId, side);
    if (have <= 0n) return { ok: false, filled: 0n, error: "Nothing to sell" };

    const b = await book.readBook(w.poolAddress);
    const want = Number(size < have ? size : have) / Number(ONE);
    const floor = ownTerms(side, yesPrice);

    // Selling walks the bids, best (highest) first, and stops at the limit —
    // which is a floor here rather than a ceiling. Written out rather than
    // mirrored through the buy-side walker: the arithmetic of `1 - price` was
    // correct but unreadable, and this is the one file that has to be obviously
    // right.
    let filled = 0;
    let proceeds = 0;
    for (const level of bidsFor(b, side)) {
      if (filled >= want) break;
      if (level.price < floor) break;
      const take = Math.min(level.size, want - filled);
      filled += take;
      proceeds += take * level.price;
    }
    if (filled <= 0) return { ok: false, filled: 0n, noLiquidity: true };

    demo.close(w.marketId, side, raw(proceeds), raw(filled));
    const average = proceeds / filled;
    return {
      ok: true,
      filled: raw(filled),
      // YES terms, like every other `fillPrice` — the bids just walked are in
      // the side's own terms, which for a short is `1 - p`.
      fillPrice: raw(side === "up" ? average : 1 - average),
    };
  },

  async rest(w, side, yesPrice, size) {
    const price = ownTerms(side, yesPrice);
    const escrow = raw((Number(size) / Number(ONE)) * price);
    if (escrow > demo.getBalance()) {
      return { ok: false, filled: 0n, error: "Not enough in the demo balance" };
    }
    demo.rest(w.marketId, side, Number(yesPrice) / Number(ONE), size, escrow);
    // A paper bid has no order on any book, so there is no id to give out —
    // which is also why a challenge cannot be posted in demo at all.
    return { ok: true, filled: 0n };
  },

  async holding(w) {
    return {
      up: demo.held(w.marketId, "up"),
      down: demo.held(w.marketId, "down"),
    };
  },

  /**
   * Move a resting paper bid along.
   *
   * Two transitions, and both used to be missing or wrong. It **fills** when
   * the live best offer on that side reaches the called price — the same test
   * the real game relies on, since that is the moment somebody would have sold
   * into the bid. It **releases** when the window closes without that
   * happening; on chain the order simply ages off and the escrow returns, and
   * not doing the equivalent here meant an unfilled bid quietly ate the balance.
   *
   * The guard matters: this is polled every couple of seconds and awaits a book
   * read in the middle, so two passes can overlap and fill the same bid twice.
   */
  async pumpResting(w) {
    if (pumping.has(w.marketId)) return;
    const pending = demo.restingIn(w.marketId);
    if (!pending) return;

    pumping.add(w.marketId);
    try {
      if (markets.secondsLeft(w) <= 0) {
        demo.expireRest(w.marketId);
        return;
      }
      const b = await book.readBook(w.poolAddress);
      if (!demo.restingIn(w.marketId)) return; // filled while we were reading
      const offer = book.best(asksFor(b, pending.side));
      const price = ownTerms(pending.side, raw(pending.yesPrice));
      if (offer && offer.price <= price) {
        // The escrow was taken when the bid was placed, so the fill itself is
        // free — this is delivery, not a second payment.
        demo.unrest(w.marketId, 0n);
        demo.fill(w.marketId, pending.side, 0n, pending.size);
      }
    } finally {
      pumping.delete(w.marketId);
    }
  },

  async claim(p) {
    const side: Side = p.outcomeIndex === 0 ? "up" : "down";
    demo.settle(p.marketId, side, p.redeemable, p.redeemable - p.balance);
    return { ok: true, paid: p.redeemable };
  },
};

// ── Picking one ─────────────────────────────────────────────────────────────

export const current = (): Executor => (demo.isActive() ? paper : chain);

/** Balance from whichever side is live, for `useSyncExternalStore`. */
export function subscribeBalance(fn: () => void) {
  const a = wallet.subscribe(fn);
  const b = demo.subscribe(fn);
  return () => {
    a();
    b();
  };
}

export const getBalance = () => current().balance();
export const getServerBalance = () => 0n;
