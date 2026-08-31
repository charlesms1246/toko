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

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  status: RoundStatus;
  /** Real tUSDC balance, raw. */
  balance: bigint;
  /** What the last settled round paid, raw. Null until one settles. */
  payout: bigint | null;
  entryCost: bigint | null;
  /** True when a press would be accepted right now. */
  canEnter: boolean;
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
 * A ticking clock. Exported because screens that show their own countdown need
 * one too, and reading `Date.now()` during render is what the React Compiler's
 * purity rule rejects.
 */
export /**
 * Markets that have already turned a press away with nothing on the other side.
 *
 * Module-level and unbounded on purpose: a market id is only ever live for
 * minutes, so the set turns over by itself, and remembering across screens is
 * the point — walking from Lucky to Snipe should not re-learn that the same
 * window is empty.
 */
const thin = new Set<string>();

/** The same choice the hook renders from, made at press time. */
function pickWindow(intervalSec: number | null, minSecsLeft: number) {
  const windows = markets.getSnapshot().windows;
  return intervalSec == null
    ? markets.shortestRound(windows, minSecsLeft, thin)
    : markets.nextToClose(windows, intervalSec, minSecsLeft);
}

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
 */
export function useRound(
  intervalSec: number | null = null,
  minSecsLeft = 0,
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
  /** The window the open position belongs to — not necessarily the live one. */
  const [playing, setPlaying] = useState<markets.Window | null>(null);

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
      ? markets.shortestRound(windows, minSecsLeft, thin)
      : markets.nextToClose(windows, intervalSec, minSecsLeft);
  const window = playing ?? live;
  const pool = window?.poolAddress;

  useEffect(() => {
    if (pool) return book.track(pool, 1200);
  }, [pool]);

  // Approve the window's pool while the console is idle. Every window is a new
  // pool, so without this each round pays for an `approve` ahead of its order —
  // two transactions on the press instead of one.
  useEffect(() => {
    if (!pool || status !== "idle") return;
    void exec.preApprove(pool);
  }, [pool, status, exec]);

  const secsLeft = window ? Math.max(0, window.expiry - now / 1000) : 0;
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
      const target = pickWindow(intervalSec, minSecsLeft);
      if (!target) {
        setMessage("No live window");
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);

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
          // Proof this window has nothing to trade against; prefer another.
          if (result.noLiquidity) thin.add(target.marketId);
          setStatus("idle");
          setSide(null);
          setMessage(
            result.noLiquidity ? "Nobody on the other side" : result.error ?? "Order failed",
          );
          return;
        }
        await active.refresh();
        setEntryCost(before - active.balance());
        setHeld(result.filled);
        setPlaying(target);
        setStatus("open");
      })();
    },
    [intervalSec, minSecsLeft],
  );

  const rest = useCallback(
    (
      nextSide: Side,
      limitPrice: number,
      contracts: number,
      options?: orders.RestOptions,
    ) => {
      const target = pickWindow(intervalSec, minSecsLeft);
      if (!target) {
        setMessage("No live window");
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);

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
        if (result.filled > 0n) {
          setHeld(result.filled);
          setStatus("open");
        } else {
          setStatus("resting");
        }
      })();
    },
    [intervalSec, minSecsLeft],
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
      const result = await active.sell(playing, side, orders.toRawPrice(limit), held);
      if (!result.ok) {
        setStatus("open");
        setMessage(
          result.noLiquidity ? "Nobody bidding right now" : result.error ?? "Sell failed",
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
    // Paper play has no on-chain positions to re-read.
    if (!execution.current().paper) void positions.refresh();
  }, []);

  // Return the console to idle a few seconds after a result.
  useEffect(() => {
    if (status !== "won" && status !== "lost" && status !== "void") return;
    const timer = setTimeout(reset, 5000);
    return () => clearTimeout(timer);
  }, [status, reset]);

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
    status: settling ? "settling" : restingExpired ? "idle" : status,
    balance,
    payout,
    entryCost,
    canEnter,
    message,
    buy,
    rest,
    sell,
    reset,
  };
}
