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
  holding(w: Window): Promise<{ up: bigint; down: bigint }>;
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
    const b = await book.readBook(w.poolAddress);
    const want = Number(size) / Number(ONE);
    // Selling wants the *highest* bids first, and a limit that is a floor
    // rather than a ceiling — so the ladder is walked against a mirrored price.
    const floor = ownTerms(side, yesPrice);
    const bids = bidsFor(b, side).map((l) => ({ ...l, price: 1 - l.price }));
    const { filled, spent } = sweep(bids, 1 - floor, want);
    if (filled <= 0) return { ok: false, filled: 0n, noLiquidity: true };

    const proceeds = raw(filled - spent);
    demo.close(w.marketId, side, proceeds, raw(filled));
    return { ok: true, filled: raw(filled), fillPrice: raw((filled - spent) / filled) };
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

  /**
   * What the player holds — and, for a resting paper bid, whether the real
   * market has come to it yet.
   *
   * The honest test is the one the real book would apply: a bid fills when
   * somebody would have sold into it, so it fills the moment the live best
   * offer on that side drops to the called price.
   */
  async holding(w) {
    const pending = demo.restingIn(w.marketId);
    if (pending) {
      const b = await book.readBook(w.poolAddress);
      const offer = book.best(asksFor(b, pending.side));
      const price = ownTerms(pending.side, raw(pending.yesPrice));
      if (offer && offer.price <= price) {
        const size = pending.size;
        demo.unrest(w.marketId, 0n); // escrow was already taken at rest time
        demo.fill(w.marketId, pending.side, 0n, size);
      }
    }
    return {
      up: demo.held(w.marketId, "up"),
      down: demo.held(w.marketId, "down"),
    };
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
