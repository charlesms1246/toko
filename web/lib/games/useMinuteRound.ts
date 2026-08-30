"use client";

/**
 * The Minute — one 1-minute window is one round.
 *
 * Enter at any point in a live window, hold to expiry, and the real oracle
 * resolves it the moment it closes. A winning contract redeems for exactly 1
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
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as markets from "@/lib/dreamdex/markets";
import * as book from "@/lib/dreamdex/book";
import * as orders from "@/lib/dreamdex/orders";
import * as positions from "@/lib/dreamdex/positions";
import * as redeem from "@/lib/dreamdex/redeem";
import * as wallet from "@/lib/dreamdex/wallet";
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

export interface MinuteRound {
  window: markets.Window | null;
  secsLeft: number;
  book: book.Book;
  impliedUp: number | null;
  /** Contracts held on the side in play, raw. */
  held: bigint;
  /** The id a resting bid is sitting under. Co-op's link points at this. */
  restingOrderId: bigint | null;
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
export function useNow(everyMs = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * @param intervalSec Which series to play. 60 is the arcade round; the 5m series
 *   (300) suits the maker games, where a resting bid needs time for the market
 *   to travel to it. Pass `null` to take whichever series fits — not `undefined`,
 *   which a default parameter would quietly turn back into 60.
 * @param minSecsLeft Only use a window with at least this long to run. A
 *   challenge whose offer stands for half an hour needs a window that outlasts
 *   it, and which series that turns out to be is not worth the caller deciding.
 */
export function useMinuteRound(
  intervalSec: number | null = 60,
  minSecsLeft = 0,
): MinuteRound {
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
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  const [status, setStatus] = useState<RoundStatus>("idle");
  const [side, setSide] = useState<Side | null>(null);
  const [held, setHeld] = useState(0n);
  const [entryCost, setEntryCost] = useState<bigint | null>(null);
  const [payout, setPayout] = useState<bigint | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [restingOrderId, setRestingOrderId] = useState<bigint | null>(null);
  const [filledOnArrival, setFilledOnArrival] = useState(false);
  /** The window the open position belongs to — not necessarily the live one. */
  const [playing, setPlaying] = useState<markets.Window | null>(null);

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
    return markets.startPolling(3000);
  }, []);

  // The window to trade is the next 1m to close; once a position is open the
  // round stays with the window it was opened in, even as the next one rolls.
  const live = markets.nextToClose(windows, intervalSec ?? undefined, minSecsLeft);
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
    void orders.preApprove(pool);
  }, [pool, status]);

  const secsLeft = window ? Math.max(0, window.expiry - now / 1000) : 0;
  const impliedUp = book.impliedUp(bookState.book);

  const askFor = (s: Side) =>
    book.best(s === "up" ? bookState.book.yesAsks : bookState.book.noAsks);
  const canEnter =
    status === "idle" &&
    !!window &&
    secsLeft > ENTRY_CUTOFF_SECONDS &&
    (!!askFor("up") || !!askFor("down")) &&
    walletState.collateral > 0n;

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
        const result = await redeem.redeem(claim);
        if (cancelled) return;
        setPayout(claim.redeemable);
        if (!result.ok) setMessage(result.error ?? "Could not claim");
        void wallet.refresh();
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
      const target = markets.nextToClose(
        markets.getSnapshot().windows,
        intervalSec ?? undefined,
        minSecsLeft,
      );
      if (!target) {
        setMessage("No live window");
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);

      void (async () => {
        const before = wallet.getSnapshot().collateral;
        const result = await orders.buy(
          target,
          nextSide,
          orders.toRawPrice(limitPrice),
          orders.toRawSize(contracts),
        );
        if (!result.ok) {
          setStatus("idle");
          setSide(null);
          setMessage(
            result.noLiquidity ? "Nobody on the other side" : result.error ?? "Order failed",
          );
          return;
        }
        await wallet.refresh();
        setEntryCost(before - wallet.getSnapshot().collateral);
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
      const target = markets.nextToClose(
        markets.getSnapshot().windows,
        intervalSec ?? undefined,
        minSecsLeft,
      );
      if (!target) {
        setMessage("No live window");
        return;
      }
      setStatus("pending");
      setSide(nextSide);
      setMessage(null);
      setPayout(null);

      void (async () => {
        const before = wallet.getSnapshot().collateral;
        const result = await orders.rest(
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
        await wallet.refresh();
        setEntryCost(before - wallet.getSnapshot().collateral);
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
      const holding = await positions.readHolding(playing);
      if (cancelled) return;
      const mine = side === "up" ? holding.up : holding.down;
      if (mine > 0n) {
        setHeld(mine);
        setStatus("open");
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
      const before = wallet.getSnapshot().collateral;
      const result = await orders.sell(playing, side, orders.toRawPrice(limit), held);
      if (!result.ok) {
        setStatus("open");
        setMessage(
          result.noLiquidity ? "Nobody bidding right now" : result.error ?? "Sell failed",
        );
        return;
      }
      await wallet.refresh();
      setPayout(wallet.getSnapshot().collateral - before);
      setHeld(0n);
      setStatus(result.ok ? "won" : "lost");
    })();
  }, [playing, side, held, bookState.book]);

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
    void positions.refresh();
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
    side,
    status: settling ? "settling" : restingExpired ? "idle" : status,
    balance: walletState.collateral,
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
