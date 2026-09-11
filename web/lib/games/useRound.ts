"use client";

/**
 * The Round — one live Event Contract window is one round.
 *
 * Enter at any point in a live window, hold to expiry, and the real oracle
 * resolves it the moment it closes. Which window that is depends on what the
 * venue is rolling: the console asks for the shortest one with runway rather
 * than naming a cadence, because the series it was designed around (one minute)
 * stopped being offered while this was being built. A winning contract redeems for exactly 1
 * tUSDC; a losing one for nothing.
 *
 * The lifecycle this owns:
 *
 *   idle → pending (order in flight, ~3s) → open (position held)
 *        → settling (window expired, waiting on the oracle) → won | lost
 *
 * Three things measured in Phase 0 shape it:
 *
 * - **The entry cutoff is liquidity, not protocol.** Fills confirmed to 2.16s
 *   before expiry, but inside the last ~2s the maker pulls its quotes. So the
 *   gate is "is there something resting to trade against", plus room for the
 *   round trip — not a hardcoded clock.
 * - **A round trip is ~3s.** The console needs a real pending state; it cannot
 *   pretend a press is instant.
 * - **Resolution is observable ~3s after expiry.** `settling` is a real state,
 *   not a flourish.
 *
 * Every order goes through `execution`, which is the single object Demo Mode
 * swaps. The window, the book, the countdown and the oracle result are the same
 * either way — only whose money moves is different.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLatest } from "@/lib/react/hooks";
import * as markets from "@/lib/dreamdex/markets";
import * as book from "@/lib/dreamdex/book";
import * as orders from "@/lib/dreamdex/orders";
import * as positions from "@/lib/dreamdex/positions";
import * as execution from "@/lib/dreamdex/execution";
import { getClient } from "@/lib/dreamdex/client";
import type { Position } from "@/lib/dreamdex/portfolio";

export type RoundStatus =
  | "idle"
  | "pending"
  /** A bid is resting on the book, waiting for the market to come to it. */
  | "resting"
  | "open"
  | "settling"
  | "won"
  | "lost"
  | "void";

export type Side = "up" | "down";

/** Leave room for the ~3s round trip plus a margin before the maker withdraws. */
export const ENTRY_CUTOFF_SECONDS = 6;

export interface Round {
  window: markets.Window | null;
  secsLeft: number;
  book: book.Book;
  impliedUp: number | null;
  /** Contracts held on the side in play, raw. */
  held: bigint;
  /** The id a resting bid is sitting under. Co-op's link points at this. */
  restingOrderId: bigint | null;
  /**
   * True when the round ended by selling out early rather than at expiry.
   *
   * A cash-out is not a settlement: it can end below what the position cost, so
   * a screen that reports every successful sell as a win is telling the player
   * something untrue about their own money.
   */
  cashedOut: boolean;
  /**
   * True when a bid crossed the moment it landed instead of resting. The
   * position is real either way, but nobody *took* anything — the book had
   * simply moved during the round trip — and a screen that says otherwise is
   * telling the player something that did not happen.
   */
  filledOnArrival: boolean;
  side: Side | null;
  /** When the position opened, ms. Null while idle. Drives the chart's mark. */
  openedAt: number | null;
  /**
   * The window after this one — its countdown, and its strike once the venue
   * has stamped one. Null when the venue has published no successor.
   */
  next: { secsLeft: number; strike: number | null } | null;
  status: RoundStatus;
  /** Real tUSDC balance, raw. */
  balance: bigint;
  /** What the last settled round paid, raw. Null until one settles. */
  payout: bigint | null;
  entryCost: bigint | null;
  /** True when a press would be accepted right now. */
  canEnter: boolean;
  /**
   * True when the last press found nothing to take. The bid was good, the book
   * was empty — which is the one failure worth offering to `rest` through.
   */
  noLiquidity: boolean;
  message: string | null;
  buy: (side: Side, limitPrice: number, contracts: number) => void;
  /** Place a bid that waits for the market instead of taking it. */
  rest: (
    side: Side,
    limitPrice: number,
    contracts: number,
    options?: orders.RestOptions,
  ) => void;
  sell: () => void;
  reset: () => void;
}

/**
 * Markets that have recently turned a press away with nothing on the other side.
 *
 * Module-level, because remembering across screens is the point — walking from
 * Lucky to Snipe should not re-learn that the same window is empty.
 *
 * **Remembered for a while, not for ever, and that distinction is the whole
 * reason the games drift off 60s windows.** `shortestRound` picks the shortest
 * live CADENCE, so with a 1m window open the console sits at 60s exactly as it
 * should. But a skipped window is excluded from that choice, and on a thin book
 * the single live 1m window gets marked on the first empty press — after which
 * the shortest remaining cadence is 5m, then 15m. The set was permanent, so one
 * unlucky press moved the whole session onto longer windows and nothing ever
 * moved it back.
 *
 * A book is not a property of a market, it is a moment: makers pull quotes and
 * come back. Forty-five seconds is long enough not to re-poke a market that is
 * genuinely dead, and short enough that a 1m window returns to the rotation.
 */
const THIN_MEMORY_MS = 45_000;
const thinAt = new Map<string, number>();

/** The ones still worth skipping, as of now. */
function thinNow(): Set<string> {
  const cutoff = Date.now() - THIN_MEMORY_MS;
  const live = new Set<string>();
  for (const [id, at] of thinAt) {
    if (at >= cutoff) live.add(id);
    else thinAt.delete(id);
  }
  return live;
}

/**
 * The window the screen actually priced, if it is still worth trading.
 *
 * `buy` and `rest` used to re-run the hook's own choice at press time instead.
 * That reads a fresh snapshot, so when the venue rolled between the last render
 * and the press it could return a DIFFERENT window from the one on screen — and
 * the limit price in the player's hand came from the other pool's book. The
 * order is a limit, so it can never fill worse than asked, but the multiple they
 * were shown belonged to a market they did not trade.
 *
 * Resolving the id they were looking at makes the two agree, and makes the roll
 * case say so rather than silently substituting. Keyed by `marketId`, never by
 * pool, because pools recycle across windows.
 */
function tradableShown(marketId: string | null, minSecsLeft: number) {
  if (!marketId) return null;
  const shown = markets
    .getSnapshot()
    .windows.find((w) => w.marketId === marketId);
  if (!shown) return null;
  return shown.expiry - Date.now() / 1000 >= minSecsLeft ? shown : null;
}

/**
 * A ticking clock. Exported because screens that show their own countdown need
 * one too, and reading `Date.now()` during render is what the React Compiler's
 * purity rule rejects.
 */
export function useNow(everyMs = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * @param intervalSec Which series to play, or `null` — the usual choice — for
 *   **whatever the shortest live series is**. Naming a cadence looks tidier and
 *   is a trap: Shannon stopped rolling its 1-minute windows, then its 5-minute
 *   ones, and anything pinned to `60` simply stopped finding a market. Pass
 *   `null`, not `undefined`, which a default parameter turns back into 60.
 * @param minSecsLeft Only use a window with at least this long to run. A
 *   challenge whose offer stands for half an hour needs a window that outlasts
 *   it, and which series that turns out to be is not worth the caller deciding.
 * @param holdResult Keep a settled round on screen until the caller resets it.
 *   A ladder spans windows, so the five-second auto-reset would take the PRESS
 *   and FOLD keys away mid-decision and discard the rungs already cleared.
 */
export function useRound(
  intervalSec: number | null = null,
  minSecsLeft = 0,
  holdResult = false,
): Round {
  const now = useNow();

  const { windows } = useSyncExternalStore(
    markets.subscribe,
    markets.getSnapshot,
    markets.getServerSnapshot,
  );
  const bookState = useSyncExternalStore(
    book.subscribeBook,
    book.getBookSnapshot,
    book.getBookServerSnapshot,
  );
  const balance = useSyncExternalStore(
    execution.subscribeBalance,
    execution.getBalance,
    execution.getServerBalance,
  );
  const exec = execution.current();

  const [status, setStatus] = useState<RoundStatus>("idle");
  const [side, setSide] = useState<Side | null>(null);
  const [held, setHeld] = useState(0n);
  const [entryCost, setEntryCost] = useState<bigint | null>(null);
  const [payout, setPayout] = useState<bigint | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [restingOrderId, setRestingOrderId] = useState<bigint | null>(null);
  const [filledOnArrival, setFilledOnArrival] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [noLiquidity, setNoLiquidity] = useState(false);
  /** The window the open position belongs to — not necessarily the live one. */
  const [playing, setPlaying] = useState<markets.Window | null>(null);
  /**
   * When the position opened, so the chart can mark the moment on the price
   * line. A timestamp rather than an index: the tick history is a rolling
   * window, so any index into it is wrong one second later.
   */
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  useEffect(() => {
    const active = execution.current();
    active.ready();
    void active.refresh();
    return markets.startPolling(3000);
  }, []);

  // The window to trade is the next 1m to close; once a position is open the
  // round stays with the window it was opened in, even as the next one rolls.
  const live =
    intervalSec == null
      ? markets.shortestRound(windows, minSecsLeft, thinNow())
      : markets.nextToClose(windows, intervalSec, minSecsLeft);
  const window = playing ?? live;
  const pool = window?.poolAddress;

  useEffect(() => {
    if (pool) return book.track(pool, 1200);
  }, [pool]);

  /**
   * The id of the window on screen, for the actions to trade against.
   *
   * Synced in an effect rather than during render, and deliberately the SAME
   * commit that starts tracking the book above — so the id and the prices the
   * player is reading always come from one window. An id, not the object,
   * because the store rebuilds `Window`s every poll.
   */
  // The book, for the no-fill record below. A ref, because the store rebuilds
  // this object every poll and a callback keyed on it would be rebuilt with it.
  const bookRef = useLatest(bookState.book);
  const shownIdRef = useRef<string | null>(null);
  const shownId = window?.marketId ?? null;
  useEffect(() => {
    shownIdRef.current = shownId;
  }, [shownId]);

  // Approve the window's pool while the console is idle. Every window is a new
  // pool, so without this each round pays for an `approve` ahead of its order —
  // two transactions on the press instead of one.
  useEffect(() => {
    if (!pool || status !== "idle") return;
    void exec.preApprove(pool);
  }, [pool, status, exec]);

  const secsLeft = window ? Math.max(0, window.expiry - now / 1000) : 0;

  /**
   * What comes after this window, for the chart's forward band.
   *
   * The strike is deliberately passed through as-is, null included: the venue
   * stamps it at roll time, so a successor that exists but has not been stamped
   * reports `null` and the chart shows a countdown without a level. Inventing
   * one would be inventing a price.
   */
  const upcoming = window ? markets.nextAfter(windows, window) : null;
  const next = upcoming
    ? {
        secsLeft: Math.max(0, upcoming.expiry - now / 1000),
        strike:
          upcoming.strike != null ? markets.strikePrice(upcoming.strike) : null,
      }
    : null;
  const impliedUp = book.impliedUp(bookState.book);

  const askFor = (s: Side) =>
    book.best(s === "up" ? bookState.book.yesAsks : bookState.book.noAsks);
  const canEnter =
    status === "idle" &&
    !!window &&
    secsLeft > ENTRY_CUTOFF_SECONDS &&
    (!!askFor("up") || !!askFor("down")) &&
    balance > 0n;

  // ── Settlement ────────────────────────────────────────────────────────────

  // Derived, not stored: "settling" is purely "we hold a position and its window
  // has closed". Writing it into state from an effect is exactly the
  // set-state-in-effect shape the React Compiler rules reject.
  const settling =
    status === "open" && !!playing && playing.expiry - now / 1000 <= 0;

  /** An unfilled resting bid dies with its window; the escrow comes back. */
  const restingExpired =
    status === "resting" && !!playing && playing.expiry - now / 1000 <= 0;

  useEffect(() => {
    if (!settling || !playing || !side) return;
    let cancelled = false;

    const poll = async () => {
      const client = getClient();
      if (!client) return;
      try {
        const chain = await client.getMarketOnchain(playing.marketId);
        if (cancelled) return;
        if (!chain?.isResolved && !chain?.isVoided) return;

        const mine = side === "up" ? 0 : 1;
        if (chain.isVoided) {
          setStatus("void");
        } else if (Number(chain.winningOutcome) === mine) {
          setStatus("won");
        } else {
          setStatus("lost");
          setPayout(0n);
          return;
        }

        // Claim straight away — this is the round's payout, and the player
        // pressed for it. Losing positions are never claimed: they pay zero and
        // would only burn gas.
        const claim: Position = {
          marketId: playing.marketId,
          poolAddress: playing.poolAddress,
          asset: playing.asset,
          interval: playing.interval,
          outcomeIndex: mine as 0 | 1,
          balance: held,
          expiry: playing.expiry,
          status: "Finalized",
          kind: chain.isVoided ? "voided" : "winner",
          redeemable: chain.isVoided ? held / 2n : held,
        };
        const result = await execution.current().claim(claim);
        if (cancelled) return;
        setPayout(result.paid);
        if (!result.ok) setMessage(result.error ?? "Could not claim");
      } catch {
        // Keep polling; the oracle lands within a few seconds.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [settling, playing, side, held]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const buy = useCallback(
    (nextSide: Side, limitPrice: number, contracts: number) => {
      const target = tradableShown(shownIdRef.current, minSecsLeft);
      if (!target) {
        // Two different failures, and they are not the same news: the venue is
        // between windows, or the one being read just rolled out from under it.
        setMessage(
          shownIdRef.current ? "That window just closed" : "No live window",
        );
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);
      setNoLiquidity(false);

      void (async () => {
        const active = execution.current();
        const before = active.balance();
        const result = await active.buy(
          target,
          nextSide,
          orders.toRawPrice(limitPrice),
          orders.toRawSize(contracts),
        );
        if (!result.ok) {
          /*
           * A no-fill against a book that was showing a price is worth a record.
           *
           * The screen quotes `yesAsks[0]` / `noAsks[0]`; this prints what was
           * actually sent beside what the book held at that moment and what it
           * holds now, which is the only way to tell a level that vanished in
           * the round trip from a ladder that was never takeable. `ERRORS.md`
           * carries this as an open question.
           */
          if (result.noLiquidity) {
            const b = bookRef.current;
            const top = (l: book.Level[]) =>
              l.slice(0, 3).map((x) => `${x.price.toFixed(3)}x${x.size}`);
            // Stringified, not an object: a devtools-collapsed `Object` is
            // useless from a log reader, and this exists to be read later.
            console.warn(
              "[round] no fill " +
                JSON.stringify({
                  side: nextSide,
                  limitSent: limitPrice,
                  contracts,
                  marketId: target.marketId,
                  secsLeft: Math.round(target.expiry - Date.now() / 1000),
                  yesAsks: top(b.yesAsks),
                  noAsks: top(b.noAsks),
                  yesBids: top(b.yesBids),
                  noBids: top(b.noBids),
                }),
            );
          }
          // Proof this window has nothing to trade against; prefer another.
          if (result.noLiquidity) thinAt.set(target.marketId, Date.now());
          setStatus("idle");
          setSide(null);
          setNoLiquidity(!!result.noLiquidity);
          setMessage(
            result.noLiquidity
              ? "Nobody on the other side"
              : (result.error ?? "Order failed"),
          );
          return;
        }
        await active.refresh();
        setEntryCost(before - active.balance());
        setHeld(result.filled);
        setPlaying(target);
        setOpenedAt(Date.now());
        setStatus("open");
      })();
    },
    [minSecsLeft, bookRef],
  );

  const rest = useCallback(
    (
      nextSide: Side,
      limitPrice: number,
      contracts: number,
      options?: orders.RestOptions,
    ) => {
      const target = tradableShown(shownIdRef.current, minSecsLeft);
      if (!target) {
        // Two different failures, and they are not the same news: the venue is
        // between windows, or the one being read just rolled out from under it.
        setMessage(
          shownIdRef.current ? "That window just closed" : "No live window",
        );
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);
      setNoLiquidity(false);

      void (async () => {
        const active = execution.current();
        const before = active.balance();
        const result = await active.rest(
          target,
          nextSide,
          orders.toRawPrice(limitPrice),
          orders.toRawSize(contracts),
          options,
        );
        if (!result.ok) {
          setStatus("idle");
          setSide(null);
          setMessage(result.error ?? "Could not place the order");
          return;
        }
        await active.refresh();
        setEntryCost(before - active.balance());
        setPlaying(target);
        setRestingOrderId(result.orderId ?? null);
        // It may have crossed on arrival if the book moved to meet it.
        setFilledOnArrival(result.filled > 0n);
        // The moment of commitment either way — a rested bid has escrow down
        // and a place on the chart just as much as a fill does.
        setOpenedAt(Date.now());
        if (result.filled > 0n) {
          setHeld(result.filled);
          setStatus("open");
        } else {
          setStatus("resting");
        }
      })();
    },
    [minSecsLeft],
  );

  // While a bid rests, the only thing that tells us it was taken is the
  // position itself — a fill is somebody else's transaction, not ours.
  useEffect(() => {
    if (status !== "resting" || !playing) return;
    let cancelled = false;
    const check = async () => {
      const active = execution.current();
      // Fills a paper bid the market has come to, or releases one whose window
      // closed. On chain both happen without us, so this is a no-op there.
      await active.pumpResting(playing);
      const holding = await active.holding(playing);
      if (cancelled) return;
      const mine = side === "up" ? holding.up : holding.down;
      if (mine > 0n) {
        setHeld(mine);
        setOpenedAt(Date.now());
        setStatus("open");
        return;
      }
      // The window closed with nobody coming: the offer is done either way, and
      // the escrow is back.
      if (markets.secondsLeft(playing) <= 0) {
        setStatus("idle");
        setPlaying(null);
        setRestingOrderId(null);
      }
    };
    void check();
    const timer = setInterval(() => void check(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, playing, side]);

  const sell = useCallback(() => {
    if (!playing || !side || held === 0n) return;
    const bid = book.best(
      side === "up" ? bookState.book.yesBids : bookState.book.noBids,
    );
    if (!bid) {
      setMessage("No bid to sell into");
      return;
    }
    const limit = side === "up" ? bid.price - 0.02 : 1 - bid.price + 0.02;
    setStatus("pending");
    void (async () => {
      const active = execution.current();
      const before = active.balance();
      const result = await active.sell(
        playing,
        side,
        orders.toRawPrice(limit),
        held,
      );
      if (!result.ok) {
        setOpenedAt(Date.now());
        setStatus("open");
        setMessage(
          result.noLiquidity
            ? "Nobody bidding right now"
            : (result.error ?? "Sell failed"),
        );
        return;
      }
      await active.refresh();
      const proceeds = active.balance() - before;
      setPayout(proceeds);
      setHeld(0n);
      setCashedOut(true);
      // Won or lost is decided by whether the sale beat what the position cost,
      // not by whether the sale itself succeeded.
      setStatus(entryCost != null && proceeds > entryCost ? "won" : "lost");
    })();
  }, [playing, side, held, bookState.book, entryCost]);

  const reset = useCallback(() => {
    setStatus("idle");
    setSide(null);
    setHeld(0n);
    setEntryCost(null);
    setPayout(null);
    setPlaying(null);
    setMessage(null);
    setRestingOrderId(null);
    setFilledOnArrival(false);
    setCashedOut(false);
    setNoLiquidity(false);
    setOpenedAt(null);
    // Paper play has no on-chain positions to re-read.
    if (!execution.current().paper) void positions.refresh();
  }, []);

  // Return the console to idle a few seconds after a result.
  useEffect(() => {
    if (holdResult) return;
    if (status !== "won" && status !== "lost" && status !== "void") return;
    const timer = setTimeout(reset, 5000);
    return () => clearTimeout(timer);
  }, [holdResult, status, reset]);

  return {
    window,
    secsLeft,
    book: bookState.book,
    impliedUp,
    held,
    restingOrderId,
    filledOnArrival,
    cashedOut,
    side,
    openedAt,
    next,
    status: settling ? "settling" : restingExpired ? "idle" : status,
    balance,
    payout,
    entryCost,
    canEnter,
    noLiquidity,
    message,
    buy,
    rest,
    sell,
    reset,
  };
}
