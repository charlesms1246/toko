"use client";

/**
 * Co-op play — a challenge that *is* a resting order.
 *
 * The whole mechanic rests on **mint-a-pair**: when a buyer of Up crosses a
 * buyer of Down, the pool mints a fresh pair and gives each side one. No seller,
 * no market maker, no inventory. So two people can trade with each other on a
 * venue that has nobody else in it, which is exactly the cold-start problem this
 * hackathon's ecosystem argument is about.
 *
 * A challenge is therefore not a record in a database. A posts a real resting
 * bid; the link carries only enough to *find* that order again. Every claim the
 * accept screen makes is re-read from the pool, because the link is a pointer
 * and anyone can write whatever they like into one.
 *
 * Three consequences that the UI has to be honest about:
 *
 * - **A resting order cannot be addressed.** The pool matches by price-time
 *   priority, so whoever accepts crosses the *best* bid on that side — not
 *   necessarily the challenger's. Measured on Shannon: a challenge rested at
 *   0.500 sat behind the market maker's 0.781/0.772/0.763 and the accepting
 *   order minted its pair against the maker instead, at a price the challenger
 *   never chose. So a challenge is only a duel when it is at the **front of the
 *   book** — see `postableRange`. And "front" is not settled at post time: the
 *   book moves, and a challenge posted at 0.697 was outbid at 0.699 within three
 *   minutes, so the accepting order minted its pair against the newcomer. Being
 *   first when the *acceptance lands* is what counts, and nothing on a public
 *   book can guarantee that. So the screens report who was actually crossed
 *   rather than assuming it was the challenger.
 * - **A's bid is public.** Being at the front of the book is exactly what makes
 *   it takeable by a stranger too. That is not a bug; it is what makes the order
 *   real, and what makes playing this indistinguishable from providing
 *   liquidity. The status below reports who actually took it.
 * - **A challenge dies with its window.** `expireTimestampNs` is pinned to the
 *   market's expiry, so an unfilled bid simply ages off and the escrow returns.
 * - **It cannot be demoed.** Both sides are real orders that must cross with
 *   each other on chain; a paper fill has nothing to cross with. The accept
 *   screen says so rather than simulating it.
 */

import type { Address } from "viem";
import * as markets from "./markets";
import * as orders from "./orders";
import * as book from "./book";
import { MAKER_GAS_LIMIT } from "./config";
import { getClient } from "./client";

export type Side = orders.Side;

/**
 * What a challenge link carries.
 *
 * Keyed by `marketId`, never by pool — pools recycle across windows *and* across
 * assets, so a link holding a pool address would eventually point at a different
 * market entirely. The pool is resolved live from the market.
 */
export interface Challenge {
  /** The window the challenge lives in. */
  marketId: string;
  /** The side the challenger bought. The person accepting takes the other one. */
  side: Side;
  /** The challenger's limit, in YES terms, 0–1. */
  yesPrice: number;
  /** Contracts. */
  size: number;
  /** The challenger's address, so their order can be found on the pool. */
  from: Address;
  /** The order id the bid rested under. */
  orderId: string;
  /** The challenger's handle, for display only — never trusted for anything. */
  handle?: string;
}

// ── The link ────────────────────────────────────────────────────────────────

const b64url = {
  encode(s: string) {
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(s: string) {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  },
};

/** Pack a challenge into a URL-safe code. Short keys keep the link tappable. */
export function encode(c: Challenge): string {
  return b64url.encode(
    JSON.stringify({
      m: c.marketId,
      s: c.side === "up" ? 1 : 0,
      p: Math.round(c.yesPrice * 1000),
      q: c.size,
      f: c.from,
      o: c.orderId,
      h: c.handle,
    }),
  );
}

/** Unpack a code. Returns null for anything malformed — links get mangled. */
export function decode(code: string): Challenge | null {
  try {
    const raw = JSON.parse(b64url.decode(code));
    if (
      typeof raw.m !== "string" ||
      typeof raw.p !== "number" ||
      typeof raw.f !== "string"
    ) {
      return null;
    }
    return {
      marketId: raw.m,
      side: raw.s === 1 ? "up" : "down",
      yesPrice: raw.p / 1000,
      size: Number(raw.q) || 1,
      from: raw.f as Address,
      orderId: String(raw.o ?? ""),
      handle: typeof raw.h === "string" ? raw.h : undefined,
    };
  } catch {
    return null;
  }
}

export const linkFor = (c: Challenge) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/c/${encode(c)}`;

// ── Where a challenge has to sit ────────────────────────────────────────────

/** One tick on the live pools: 0.001 of probability. */
const TICK = 0.001;

/**
 * The YES prices at which a challenge actually reaches the person you sent it
 * to, given the live book.
 *
 * Two bounds, and both are real:
 *
 * - **Above the best bid**, or someone else's bid fills first and your friend
 *   ends up trading with the market maker while your order sits untouched.
 * - **Below the best ask**, or the order crosses the moment it lands. That is a
 *   perfectly good trade, but it is not a challenge — there is nothing left
 *   resting to share.
 *
 * Both sides quote one book, so the window is the spread itself whichever side
 * is being challenged: a NO bid of `q` is a YES ask of `1 − q`.
 *
 * Returns null when the spread is too tight to fit an order between the two.
 */
export function postableRange(b: book.Book): { min: number; max: number } | null {
  const yesBid = book.best(b.yesBids)?.price;
  const yesAsk = book.best(b.yesAsks)?.price;
  const noBid = book.best(b.noBids)?.price;
  const noAsk = book.best(b.noAsks)?.price;

  const floor = Math.max(yesBid ?? 0, noAsk == null ? 0 : 1 - noAsk);
  const ceil = Math.min(yesAsk ?? 1, noBid == null ? 1 : 1 - noBid);

  const min = floor + TICK;
  const max = ceil - TICK;
  return max < min ? null : { min, max };
}

/** Evenly spaced prices inside the postable range, cheapest for you first. */
export function priceLadder(b: book.Book, steps = 5): number[] {
  const range = postableRange(b);
  if (!range) return [];
  if (steps < 2) return [range.min];
  const gap = (range.max - range.min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) =>
    Math.round((range.min + gap * i) / TICK) * TICK,
  );
}

// ── Live status ─────────────────────────────────────────────────────────────

export type ChallengeState =
  /** The market list has not been read yet — not the same as "gone". */
  | "loading"
  /** Still on the book. This is the only state that can be accepted. */
  | "open"
  /** Somebody crossed it — possibly the invited player, possibly a stranger. */
  | "taken"
  /** The window closed before anyone took it. The escrow went back. */
  | "expired"
  /** The challenger pulled it. */
  | "cancelled";

export interface ChallengeStatus {
  state: ChallengeState;
  /** The window, when it is still live. */
  window: markets.Window | null;
  /** Seconds until the window closes. */
  secsLeft: number;
  /** Who took it, when we can tell. */
  takenBy?: Address;
  /**
   * Whether the challenge is currently the best bid on its side. False means
   * somebody is bidding better, so accepting would cross *them* — cheaper for
   * the accepter, but not the duel the link promised.
   */
  atFront?: boolean;
}

/**
 * Read a challenge's real state off the chain.
 *
 * The order of these checks matters. An order that is gone from the book has
 * either filled or been cancelled, and only the fill history can tell those
 * apart — so the book is checked first and the tape only when it has to be.
 */
export async function status(c: Challenge): Promise<ChallengeStatus> {
  const snapshot = markets.getSnapshot();

  // An empty list before the first load is not an expired challenge. Reporting
  // "gone" here would tell someone their invite had died a second after they
  // opened it, which is the failure this whole module exists to avoid.
  if (!snapshot.at) {
    return { state: "loading", window: null, secsLeft: 0 };
  }

  const window = snapshot.windows.find((w) => w.marketId === c.marketId) ?? null;

  // A window that is no longer live has rolled: the bid aged off with it.
  if (!window) {
    return { state: "expired", window: null, secsLeft: 0 };
  }

  const secsLeft = markets.secondsLeft(window);
  const resting = await orders.openOrdersOf(window.poolAddress, c.from);
  if (resting.some((id) => id.toString() === c.orderId)) {
    const b = await book.readBook(window.poolAddress, 1);
    const bestBid = book.best(b.yesBids)?.price;
    // Their bid competes with everyone else's; ours only wins if it is first.
    const atFront = bestBid == null || c.yesPrice >= bestBid;
    return { state: "open", window, secsLeft, atFront };
  }

  // Gone from the book. Look for the fill that removed it.
  const takenBy = await crossedBy(window.poolAddress, c.from);
  return {
    state: takenBy ? "taken" : "cancelled",
    window,
    secsLeft,
    takenBy,
  };
}

/**
 * Who crossed the challenger's resting order, if anyone.
 *
 * The challenger is the *maker* here — they rested first — so their fills are
 * the rows where `maker` is their address, and the counterparty is the taker.
 */
async function crossedBy(pool: string, challenger: Address): Promise<Address | undefined> {
  const client = getClient();
  if (!client) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fills = (await client.getFills(pool, { limit: 100 })) as any[];
    const mine = fills.find(
      (f) => String(f.maker).toLowerCase() === challenger.toLowerCase(),
    );
    return mine ? (mine.taker as Address) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The maker an address most recently crossed on a pool.
 *
 * Called after accepting, so the screen can say who the trade was actually with
 * instead of assuming the link's challenger. They differ whenever the challenge
 * was outbid between being posted and being taken.
 */
export async function crossedWith(pool: string, taker: Address): Promise<Address | undefined> {
  const client = getClient();
  if (!client) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fills = (await client.getFills(pool, { limit: 50 })) as any[];
    const mine = fills.find(
      (f) => String(f.taker).toLowerCase() === taker.toLowerCase(),
    );
    return mine ? (mine.maker as Address) : undefined;
  } catch {
    return undefined;
  }
}

// ── Accepting ───────────────────────────────────────────────────────────────

/**
 * How much the accepting player pays, in collateral.
 *
 * `yesPrice` is the YES price on both sides, so the challenger paying `p` for Up
 * leaves the opposite side costing `1 − p`. The two sum to exactly 1, which is
 * the whole reason a pair can be minted out of them.
 */
export const costToAccept = (c: Challenge) =>
  (c.side === "up" ? 1 - c.yesPrice : c.yesPrice) * c.size;

/** What the winner collects: 1 collateral unit per contract. */
export const payout = (c: Challenge) => c.size;

/**
 * Take the other side of a challenge.
 *
 * The accepting player buys the opposite outcome at a price that crosses the
 * challenger's resting bid. Because `price` is the YES price on all four sides,
 * "crossing" means quoting a YES price on the *far* side of theirs — which is
 * lower when taking Down and higher when taking Up. `CROSS_TICKS` of room covers
 * the grid snap; the pool fills at the resting order's price regardless, so the
 * extra ticks cost nothing when the cross lands.
 */
const CROSS_TICKS = 0.003;

/**
 * Crossing a *resting* order to mint a pair costs far more gas than taking the
 * market maker's quote. Measured on Shannon: taking a quote that minted a pair
 * used 826,781, while crossing a challenge ran out at **1,969,851** against a
 * 2,000,000 ceiling and reverted with no decodable reason — the out-of-gas
 * signature. So the accepting order is given the maker ceiling.
 */
export async function accept(
  c: Challenge,
  window: markets.Window,
): Promise<orders.OrderOutcome> {
  const mySide: Side = c.side === "up" ? "down" : "up";
  const limit =
    mySide === "down" ? c.yesPrice - CROSS_TICKS : c.yesPrice + CROSS_TICKS;

  return orders.buy(
    window,
    mySide,
    orders.toRawPrice(limit),
    orders.toRawSize(c.size),
    MAKER_GAS_LIMIT,
  );
}
