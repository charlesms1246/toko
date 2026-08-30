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
import * as wallet from "./wallet";
import { MAKER_GAS_LIMIT } from "./config";
import { getClient } from "./client";

export type Side = orders.Side;

/**
 * Marks a resting order as a TOKO challenge — `0x544f4b4f`, ASCII "TOKO".
 *
 * `userData` is an opaque per-order field the pool stores and hands back
 * verbatim; the venue's own market maker uses small integers in it for
 * bookkeeping. Writing a known value into it is what makes the public list
 * exact rather than a guess: a challenge is not "any order that isn't the
 * maker's", it is an order that says it is one. Verified round-tripping on
 * chain — see TESTNET_FACTS §4c.
 */
export const DUEL_TAG = 0x544f4b4fn;

/**
 * How long a challenge stands on the book waiting for someone.
 *
 * This is the order's own `expireTimestampNs`, not the series — so durations
 * the venue has no series for (30m) are perfectly real, and an unclaimed offer
 * ages off **by protocol**, returning its escrow with no client running.
 */
export const ESCROW_OPTIONS = [
  { label: "5m", secs: 5 * 60 },
  { label: "30m", secs: 30 * 60 },
  { label: "1h", secs: 60 * 60 },
  { label: "4h", secs: 4 * 60 * 60 },
] as const;

/**
 * Fraction of the escrow after which an unclaimed challenge is pulled.
 *
 * Half the offer's life is long enough to find a taker; past that the collateral
 * is better back in the challenger's hands than sitting on a book nobody is
 * crossing. The pool's own expiry is the backstop for anyone who closes the app
 * before this fires.
 */
export const REVERT_AT = 0.5;

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

// ── Reading the queue ───────────────────────────────────────────────────────

/**
 * What one contract costs the buyer of a side, given a YES price.
 *
 * `price` is the YES price on both sides, so a Down buyer pays the complement.
 * Every comparison about "better" or "worse" has to go through this: for Up a
 * higher number is worse, for Down a *lower* one is.
 */
export const costOf = (side: Side, yesPrice: number) =>
  side === "up" ? yesPrice : 1 - yesPrice;

/**
 * Is this challenge first in its queue?
 *
 * The two sides queue on opposite ends of one book, and this is easy to get
 * backwards. A `BUY_YES` rests as a **bid**, so its rivals are the other bids
 * and the front is the *highest* of them. A `BUY_NO` rests as an **ask** — a
 * Down buyer paying more means a lower YES number — so its rivals are the asks
 * and the front is the *lowest*.
 *
 * Comparing both sides against the bid ladder, as this first did, reports every
 * short as being in front when it may be last.
 */
export function isAtFront(side: Side, yesPrice: number, b: book.Book): boolean {
  if (side === "up") {
    const best = book.best(b.yesBids)?.price;
    return best == null || yesPrice >= best;
  }
  const best = book.best(b.yesAsks)?.price;
  return best == null || yesPrice <= best;
}

/**
 * The most a challenger might have to pay to stay in front: the *generous* end
 * of the spread, opposite `frontPrice`. Null when the spread has no room.
 *
 * This is the natural budget for keeping an offer alive, because it is the
 * dearest price the knob was already offering when they posted — so staying in
 * front never costs more than something they were shown and accepted.
 */
export function budgetPrice(b: book.Book, side: Side): number | null {
  const range = postableRange(b);
  if (!range) return null;
  return side === "up" ? range.max : range.min;
}

/**
 * The **cheapest** price that still puts a side at the front of the book, or
 * null when the spread has no room for one.
 *
 * Every price in the postable range is in front; this picks the one that costs
 * the challenger least. For Up that is the bottom of the range, for Down the
 * top — because a Down buyer pays the complement, so a *higher* YES number is
 * the cheaper one.
 */
export function frontPrice(b: book.Book, side: Side): number | null {
  const range = postableRange(b);
  if (!range) return null;
  return side === "up" ? range.min : range.max;
}

// ── The public board ────────────────────────────────────────────────────────

export interface OpenChallenge {
  challenge: Challenge;
  window: markets.Window;
  /** Seconds until the offer ages off the book. */
  offerSecsLeft: number;
  /** Seconds until the window settles. */
  windowSecsLeft: number;
  /** What taking it costs, in collateral. */
  cost: number;
}

/**
 * Every open challenge, read straight off the pools.
 *
 * There is no backend and no registry: the board *is* the order books. Each live
 * window's resting orders are read on chain and filtered to the ones tagged
 * `DUEL_TAG`, so anyone can see and take any challenge — including ones posted
 * by people who never told them about it.
 *
 * Both sides have to be read. A `BUY_YES` rests as a bid; a `BUY_NO` is
 * economically a YES ask, so it rests on the other side of the same book.
 *
 * Every live window is scanned, not the first few. Windows are ordered by
 * expiry, so a cap silently hides exactly the long-dated challenges that a long
 * offer produces — a 30-minute offer lands on a 24h window, which sorts last.
 * Shannon runs about fourteen windows at a time and the venue documents no rate
 * limits, so the honest read is the affordable one.
 */
export async function listOpen(maxWindows = 32): Promise<OpenChallenge[]> {
  const client = getClient();
  if (!client) return [];

  const windows = markets
    .getSnapshot()
    .windows.filter((w) => markets.secondsLeft(w) > 0)
    .slice(0, maxWindows);

  const perWindow = await Promise.all(
    windows.map(async (window) => {
      const sides = await Promise.all(
        [true, false].map(async (isBid) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res = (await (client as any).getAllOpenOrdersOnchain(window.poolAddress, {
              isBid,
              limit: 50,
            })) as { orders?: RawOrder[] };
            return (res?.orders ?? []).map((o) => ({ order: o, isBid }));
          } catch {
            return [];
          }
        }),
      );
      return sides.flat().flatMap(({ order, isBid }) => {
        const open = toOpen(order, isBid, window);
        return open ? [open] : [];
      });
    }),
  );

  return perWindow
    .flat()
    .sort((a, b) => a.offerSecsLeft - b.offerSecsLeft);
}

interface RawOrder {
  orderId: bigint;
  owner: Address;
  userData: bigint;
  price: bigint;
  quantityRemaining: bigint;
  expireTimestampNs: bigint;
}

const RAW = 1e6;

/** One resting order, if it is a live TOKO challenge. */
function toOpen(
  o: RawOrder,
  isBid: boolean,
  window: markets.Window,
): OpenChallenge | null {
  if (BigInt(o.userData) !== DUEL_TAG) return null;
  if (BigInt(o.quantityRemaining) <= 0n) return null;

  const offerSecsLeft =
    Number(BigInt(o.expireTimestampNs) / 1_000_000_000n) - Date.now() / 1000;
  if (offerSecsLeft <= 0) return null;

  const challenge: Challenge = {
    marketId: window.marketId,
    side: isBid ? "up" : "down",
    yesPrice: Number(o.price) / RAW,
    size: Number(o.quantityRemaining) / RAW,
    from: o.owner,
    orderId: o.orderId.toString(),
  };

  return {
    challenge,
    window,
    offerSecsLeft,
    windowSecsLeft: markets.secondsLeft(window),
    cost: costToAccept(challenge),
  };
}

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
    return {
      state: "open",
      window,
      secsLeft,
      atFront: isAtFront(c.side, c.yesPrice, b),
    };
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

// ── Keeping a challenge alive ───────────────────────────────────────────────

/**
 * Watch your own challenge and keep it takeable.
 *
 * A challenge does not fail because it ran out of time. It fails because it goes
 * **stale**: the book moves, somebody outbids it, and from behind the queue it
 * can never fill — whoever accepts crosses the better bid instead. Waiting
 * longer on a stale price cannot help. So the trigger here is being outbid, not
 * a fraction of a clock.
 *
 * When that happens the offer is re-posted at the front rather than simply
 * pulled, because a live front-of-book challenge is the thing this whole feature
 * exists to create — cancelling it would destroy exactly the liquidity it was
 * meant to add. Both paths cost the same single cancel.
 *
 * **A budget bounds the chase.** Following the front as the market moves would
 * otherwise raise the challenger's cost without limit, so `maxCost` caps it —
 * defaulted to the dearest price the knob was already offering when they posted,
 * so staying in front never costs more than something they were shown. When the
 * front passes it the offer stops and the escrow comes back, which is a
 * principled way to give up rather than an arbitrary deadline.
 *
 * Note the budget has to be *above* the posted price for any of this to happen:
 * being outbid means somebody is paying more, so matching them always costs more
 * than what was posted. Setting the cap to the posted price makes the re-post
 * branch unreachable — measured, and the reason `maxCost` is passed in rather
 * than derived from the price.
 *
 * This lives at module level so leaving the duel screen does not abandon the
 * offer. It is still best-effort — close the tab and nothing of ours runs —
 * which is why the order also carries its own `expireTimestampNs`, enforced by
 * the pool whatever we do.
 */

export type KeepAliveStatus =
  /** On the book and reachable. */
  | "live"
  /** Somebody crossed it. */
  | "taken"
  /** The offer's own lifetime ran out. */
  | "expired"
  /** Staying in front would cost more than the challenger agreed to pay. */
  | "pricedOut"
  | "idle";

export interface KeepAliveState {
  status: KeepAliveStatus;
  orderId: bigint | null;
  /** The price currently posted, which moves as the offer is re-posted. */
  yesPrice: number;
  /** How many times the offer has been moved to the front. */
  reposts: number;
  message: string | null;
}

const IDLE: KeepAliveState = {
  status: "idle",
  orderId: null,
  yesPrice: 0,
  reposts: 0,
  message: null,
};

let keepState: KeepAliveState = IDLE;
const keepListeners = new Set<() => void>();

function setKeep(patch: Partial<KeepAliveState>) {
  keepState = { ...keepState, ...patch };
  keepListeners.forEach((fn) => fn());
}

export function subscribeKeepAlive(fn: () => void) {
  keepListeners.add(fn);
  return () => {
    keepListeners.delete(fn);
  };
}

export const getKeepAlive = () => keepState;
export const getKeepAliveServer = () => IDLE;

/** How long to tolerate being outbid before moving. Avoids thrashing on a blip. */
const OUTBID_GRACE_MS = 30_000;
const POLL_MS = 6_000;

let keepTimer: ReturnType<typeof setInterval> | null = null;

export function keepAlive(opts: {
  window: markets.Window;
  side: Side;
  orderId: bigint;
  yesPrice: number;
  size: number;
  escrowSecs: number;
  /** The most this may cost per contract while chasing the front. */
  maxCost: number;
  /** Fired once the offer is off the book for good, whatever the reason. */
  onFinish?: (status: KeepAliveStatus) => void;
}): () => void {
  stopKeepAlive();

  const { window, side, size, escrowSecs, maxCost } = opts;
  const startedAt = Date.now();
  let orderId = opts.orderId;
  let yesPrice = opts.yesPrice;
  let reposts = 0;
  let outbidSince: number | null = null;
  let busy = false;

  setKeep({ status: "live", orderId, yesPrice, reposts, message: null });

  const finish = (status: KeepAliveStatus, message: string | null) => {
    stopKeepAlive();
    setKeep({ status, message });
    // The balance moved on every one of these paths — a fill, a refund, or a
    // cancel — so it is refreshed here rather than by each caller.
    void wallet.refresh();
    opts.onFinish?.(status);
  };

  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const secsLeft = escrowSecs - (Date.now() - startedAt) / 1000;

      // Gone from the book: taken by somebody, since we are the only one who
      // cancels it.
      const own = await orders.ownOpenOrders(window.poolAddress);
      const stillResting = own.some((id) => id === orderId);
      if (!stillResting) {
        finish("taken", "Somebody took it");
        return;
      }

      if (secsLeft <= 0) {
        await orders.cancel(window.poolAddress, orderId);
        finish("expired", "Offer expired — escrow returned");
        return;
      }

      const b = await book.readBook(window.poolAddress, 1);
      if (isAtFront(side, yesPrice, b)) {
        outbidSince = null;
        return;
      }

      outbidSince ??= Date.now();
      if (Date.now() - outbidSince < OUTBID_GRACE_MS) return;

      const front = frontPrice(b, side);
      if (front == null) return; // spread has no room; wait for it to open
      if (costOf(side, front) > maxCost) {
        await orders.cancel(window.poolAddress, orderId);
        finish("pricedOut", "Market moved past your price — escrow returned");
        return;
      }

      // Move to the front: pull, then re-rest for whatever life the offer has
      // left. A failed cancel means it filled between the two reads, which the
      // next pass reports as taken.
      const pulled = await orders.cancel(window.poolAddress, orderId);
      if (!pulled.ok) return;

      const again = await orders.rest(
        window,
        side,
        orders.toRawPrice(front),
        orders.toRawSize(size),
        {
          expireNs: BigInt(Math.floor(Date.now() / 1000 + secsLeft)) * 1_000_000_000n,
          userData: DUEL_TAG,
        },
      );
      if (!again.ok || again.orderId == null) {
        finish("expired", again.error ?? "Could not move the offer — escrow returned");
        return;
      }

      orderId = again.orderId;
      yesPrice = front;
      reposts += 1;
      outbidSince = null;
      setKeep({ orderId, yesPrice, reposts, message: null });
    } catch {
      // A read failed; try again next pass rather than abandon the offer.
    } finally {
      busy = false;
    }
  };

  keepTimer = setInterval(() => void run(), POLL_MS);
  return stopKeepAlive;
}

/** Stop watching. The order stays on the book until taken or expired. */
export function stopKeepAlive() {
  if (keepTimer) clearInterval(keepTimer);
  keepTimer = null;
}

/** Reset the watcher's reported state, once a screen has shown its result. */
export function clearKeepAlive() {
  stopKeepAlive();
  keepState = IDLE;
  keepListeners.forEach((fn) => fn());
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
