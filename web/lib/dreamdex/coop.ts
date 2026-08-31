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
import * as positions from "./positions";
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
 * `userData` carries the tag in its high 32 bits and a **challenge id** in its
 * low 32 — verified round-tripping a full 64-bit value on chain.
 *
 * The id is what makes a shared link survive. An offer's market and order id
 * both change when it is re-posted to the front or rolled into the next window,
 * so a link naming either would break the moment the offer looked after itself.
 * The id never changes, so a link points at *the challenge* rather than at one
 * particular order.
 */
export const packTag = (id: number) => (DUEL_TAG << 32n) | BigInt(id >>> 0);
export const isDuelTag = (userData: bigint) => (BigInt(userData) >> 32n) === DUEL_TAG;
export const idFromTag = (userData: bigint) => Number(BigInt(userData) & 0xffffffffn);

/** A fresh challenge id. Only has to be unique per challenger. */
export const newChallengeId = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

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
  /** Stable identity, carried in `userData`. Survives re-posts and rolls. */
  id: number;
  /** The challenger's address — the other half of the identity. */
  from: Address;
  /** The side the challenger bought. Whoever takes it gets the other one. */
  side: Side;
  /**
   * The price and window the offer had when the link was made. Both move, so
   * these are hints for display and for finding it quickly — never trusted.
   */
  yesPrice: number;
  size: number;
  marketId?: string;
  /** The challenger's handle, for display only. */
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
      i: c.id,
      f: c.from,
      s: c.side === "up" ? 1 : 0,
      p: Math.round(c.yesPrice * 1000),
      q: c.size,
      m: c.marketId,
      h: c.handle,
    }),
  );
}

/** Unpack a code. Returns null for anything malformed — links get mangled. */
export function decode(code: string): Challenge | null {
  try {
    const raw = JSON.parse(b64url.decode(code));
    if (typeof raw.f !== "string" || typeof raw.i !== "number") return null;
    return {
      id: raw.i,
      from: raw.f as Address,
      side: raw.s === 1 ? "up" : "down",
      yesPrice: Number(raw.p) / 1000,
      size: Number(raw.q) || 1,
      marketId: typeof raw.m === "string" ? raw.m : undefined,
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
  /** The order it is resting under *right now*. Changes when it moves. */
  orderId: bigint;
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
  const windows = markets
    .getSnapshot()
    .windows.filter((w) => markets.secondsLeft(w) > 0)
    .slice(0, maxWindows);

  const perWindow = await Promise.all(windows.map(ordersIn));
  return perWindow.flat().sort((a, b) => a.offerSecsLeft - b.offerSecsLeft);
}

/** Every live challenge resting in one window, both sides of its book. */
async function ordersIn(window: markets.Window): Promise<OpenChallenge[]> {
  const client = getClient();
  if (!client) return [];

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
  if (!isDuelTag(o.userData)) return null;
  if (BigInt(o.quantityRemaining) <= 0n) return null;

  const offerSecsLeft =
    Number(BigInt(o.expireTimestampNs) / 1_000_000_000n) - Date.now() / 1000;
  if (offerSecsLeft <= 0) return null;

  const challenge: Challenge = {
    id: idFromTag(o.userData),
    from: o.owner,
    side: isBid ? "up" : "down",
    yesPrice: Number(o.price) / RAW,
    size: Number(o.quantityRemaining) / RAW,
    marketId: window.marketId,
  };

  return {
    challenge,
    orderId: o.orderId,
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
  /** On the book somewhere. This is the only state that can be accepted. */
  | "open"
  /** Nothing of this challenge is resting any more. */
  | "gone";

export interface ChallengeStatus {
  state: ChallengeState;
  /** Where it is resting now, when it is. */
  open: OpenChallenge | null;
  /**
   * Whether it is first in its queue. False means somebody is bidding better,
   * so accepting would cross *them* — cheaper for the accepter, but not the duel
   * the link promised.
   */
  atFront?: boolean;
}

/**
 * Find a challenge on chain by identity.
 *
 * A link names `(challenger, id)`, never a market or an order, because both of
 * those change every time the offer is re-posted to the front or rolled into the
 * next window. So this looks for the order carrying that id, wherever it now is.
 *
 * The link's `marketId` is a hint — the window it was in when shared. Checking
 * that pool first makes the common case one read instead of a full sweep, and
 * the sweep is only paid once the offer has actually moved.
 */
export async function status(c: Challenge): Promise<ChallengeStatus> {
  const snapshot = markets.getSnapshot();

  // An empty list before the first load is not a dead challenge. Reporting
  // "gone" here would tell someone their invite had died a second after they
  // opened it, which is the failure this whole module exists to avoid.
  if (!snapshot.at) return { state: "loading", open: null };

  const hint = c.marketId
    ? (snapshot.windows.find((w) => w.marketId === c.marketId) ?? null)
    : null;

  const found =
    (hint ? await findIn(hint, c) : null) ??
    (await listOpen()).find(
      (r) => r.challenge.id === c.id && sameAddress(r.challenge.from, c.from),
    ) ??
    null;

  if (!found) return { state: "gone", open: null };

  const b = await book.readBook(found.window.poolAddress, 1);
  return {
    state: "open",
    open: found,
    atFront: isAtFront(found.challenge.side, found.challenge.yesPrice, b),
  };
}

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Look for the challenge in one window, both sides of its book. */
async function findIn(
  window: markets.Window,
  c: Challenge,
): Promise<OpenChallenge | null> {
  for (const row of await ordersIn(window)) {
    if (row.challenge.id === c.id && sameAddress(row.challenge.from, c.from)) {
      return row;
    }
  }
  return null;
}

/**
 * Who crossed a challenger's resting order, if anyone.
 *
 * The challenger is the *maker* here — they rested first — so their fills are
 * the rows where `maker` is their address, and the counterparty is the taker.
 */
export async function crossedBy(
  pool: string,
  challenger: Address,
): Promise<Address | undefined> {
  const client = getClient();
  if (!client) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fills = (await client.getFills(pool, { limit: 100 })) as any[];
    const mine = fills.find((f) => sameAddress(String(f.maker), challenger));
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
export async function crossedWith(
  pool: string,
  taker: Address,
): Promise<Address | undefined> {
  const client = getClient();
  if (!client) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fills = (await client.getFills(pool, { limit: 50 })) as any[];
    const mine = fills.find((f) => sameAddress(String(f.taker), taker));
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
 * It also **rolls the offer forward**. An order cannot outlive its market, so a
 * long offer would otherwise have to be posted in a long window and settle hours
 * after it was taken. Instead the offer sits in a short window and is re-posted
 * into the successor when that one closes, which keeps settlement minutes away
 * however long the offer stands. The challenge keeps its identity across the
 * roll — `userData` carries a stable id — so links shared before it moved still
 * resolve.
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
/**
 * How early to carry an offer into the next window.
 *
 * Not just enough to beat the entry cutoff — a window's last stretch is where
 * the price runs to extremes, because the outcome is nearly decided. Measured:
 * an offer with a 0.97 budget priced out at 44 s left on a 5-minute window while
 * waiting for a 15-second roll lead. Chasing the front there is chasing a number
 * that has nothing to do with a fresh duel's odds.
 *
 * So the offer migrates while prices still mean something: a quarter of the
 * window, floored at 20 s and capped at two minutes.
 */
const rollLeadFor = (w: markets.Window) =>
  Math.min(120, Math.max(20, w.intervalSec * 0.25));

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
  /** The challenge's stable id, so it keeps its identity across every move. */
  challengeId: number;
  /** Fired once the offer is off the book for good, whatever the reason. */
  onFinish?: (status: KeepAliveStatus) => void;
}): () => void {
  stopKeepAlive();

  const { side, size, escrowSecs, maxCost, challengeId } = opts;
  const startedAt = Date.now();
  let window = opts.window;
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

  /**
   * Put the offer on the book at `price` in `target`, replacing whatever is
   * there. Used for both reasons an offer moves: outbid, and window rolled.
   */
  const move = async (target: markets.Window, price: number, secsLeft: number) => {
    if (target.poolAddress !== window.poolAddress) {
      // A new window is a new pool, so the collateral has to be approved to it.
      await orders.preApprove(target.poolAddress);
    }
    const again = await orders.rest(
      target,
      side,
      orders.toRawPrice(price),
      orders.toRawSize(size),
      {
        expireNs: BigInt(Math.floor(Date.now() / 1000 + secsLeft)) * 1_000_000_000n,
        userData: packTag(challengeId),
      },
    );
    if (!again.ok || again.orderId == null) return false;
    window = target;
    orderId = again.orderId;
    yesPrice = price;
    reposts += 1;
    outbidSince = null;
    setKeep({ orderId, yesPrice, reposts, message: null });
    return true;
  };

  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const secsLeft = escrowSecs - (Date.now() - startedAt) / 1000;
      const windowSecsLeft = markets.secondsLeft(window);
      const rollLead = rollLeadFor(window);

      // Gone from the book: taken by somebody, since we are the only one who
      // cancels it. Only trustworthy while the window is still live — an
      // expired window drops the order without anyone taking it.
      if (windowSecsLeft > rollLead) {
        const own = await orders.ownOpenOrders(window.poolAddress);
        if (!own.some((id) => id === orderId)) {
          finish("taken", "Somebody took it");
          return;
        }
      }

      if (secsLeft <= 0) {
        if (windowSecsLeft > 0) await orders.cancel(window.poolAddress, orderId);
        finish("expired", "Offer expired — escrow returned");
        return;
      }

      // ── The window is about to close: carry the offer into the next one ──
      if (windowSecsLeft <= rollLead) {
        const next = markets.nextToClose(
          markets.getSnapshot().windows,
          window.intervalSec,
          rollLead,
        );
        if (!next || next.marketId === window.marketId) return; // wait for it
        const nb = await book.readBook(next.poolAddress, 1);
        const front = frontPrice(nb, side);
        if (front == null || costOf(side, front) > maxCost) {
          if (windowSecsLeft > 0) await orders.cancel(window.poolAddress, orderId);
          finish("pricedOut", "The next window opened past your price — escrow returned");
          return;
        }
        // Rolling is the one place a stale read can cost real money: the
        // "taken" check above is skipped inside the roll lead, so an offer
        // filled during it would be re-posted here and the challenger would end
        // up holding a position *and* a fresh offer.
        //
        // A cancel that fails on a live window means exactly that — it filled
        // between the two reads — so it is treated as taken rather than moved.
        if (windowSecsLeft > 0) {
          const pulled = await orders.cancel(window.poolAddress, orderId);
          if (!pulled.ok) {
            finish("taken", "Somebody took it");
            return;
          }
        } else if ((await heldIn(window, side)) > 0n) {
          // The window closed before we got to it and we are holding the
          // outcome, so it was filled rather than aged off.
          finish("taken", "Somebody took it");
          return;
        }
        if (!(await move(next, front, secsLeft))) {
          finish("expired", "Could not carry the offer forward — escrow returned");
        }
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
      if (!await move(window, front, secsLeft)) {
        finish("expired", "Could not move the offer — escrow returned");
      }
    } catch {
      // A read failed; try again next pass rather than abandon the offer.
    } finally {
      busy = false;
    }
  };

  keepTimer = setInterval(() => void run(), POLL_MS);
  return stopKeepAlive;
}

/** Contracts held on one side of a window — how a fill is confirmed after the
 * fact, when the order is gone and there is nothing left to cancel. */
async function heldIn(window: markets.Window, side: Side): Promise<bigint> {
  try {
    const holding = await positions.readHolding(window);
    return side === "up" ? holding.up : holding.down;
  } catch {
    return 0n;
  }
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
