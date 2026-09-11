"use client";

/**
 * The roll ladder — Press.
 *
 * A rung is one real Round. Win it and the payout becomes the stake for
 * the next rung, so the multiple compounds across consecutive windows; lose a
 * rung and the ladder ends with it. Folding stops and keeps what the last rung
 * paid.
 *
 * This is what "tighten the band, or fold" becomes on a venue with one strike
 * per window: you cannot buy a band, but you can stake a win on the next
 * window, and that is the same ratchet.
 *
 * Two rules it holds to:
 *
 * - **Rolling is always an explicit press.** Each rung spends real collateral,
 *   so the console offers PRESS or FOLD and never rolls on its own.
 * - **Nothing is recorded outside an event handler.** Banking a settled rung
 *   from an effect would be the `set-state-in-effect` shape the React Compiler
 *   rules reject, so a rung is banked when the player presses on from it, and
 *   the live rung's outcome is read straight off the round.
 */

import { useCallback, useState } from "react";
import { useRound, type Round, type Side } from "./useRound";
import { fromRaw } from "@/lib/dreamdex/config";

export interface Rung {
  /** Contracts staked into this rung. */
  contracts: number;
  /** Collateral paid for it, tUSDC. */
  cost: number;
}

export interface RollLadder {
  round: Round;
  /** Rungs already won and pressed on, oldest first. */
  banked: Rung[];
  /** Rungs won back to back, including the one just settled. */
  height: number;
  /** Contracts the next press would stake. */
  nextStake: number;
  /**
   * Collateral put into the ladder so far, tUSDC — including the rung currently
   * riding. Counting only banked rungs read as $0.00 while a rung was live,
   * which is exactly when the number matters.
   */
  atRisk: number;
  /** A rung has just won and can be pressed on. */
  canPress: boolean;
  /** The ladder is over — a rung lost, or the player folded. */
  finished: boolean;
  /** Nothing staked yet. */
  idle: boolean;
  start: (side: Side) => void;
  press: () => void;
  fold: () => void;
  /** Clear a finished ladder and go back to the start. */
  clear: () => void;
}

const BASE_CONTRACTS = 1;
const SLIPPAGE = 0.02;

export function useRollLadder(): RollLadder {
  const [banked, setBanked] = useState<Rung[]>([]);
  const [stake, setStake] = useState(BASE_CONTRACTS);
  const [folded, setFolded] = useState(false);
  const [started, setStarted] = useState(false);
  // A rung's result is the player's to act on. The round's own five-second
  // auto-reset would take PRESS and FOLD away mid-decision and drop the rungs
  // already banked, so a ladder in progress holds its result until pressed.
  const round = useRound(null, 0, started);

  const justWon = round.status === "won";
  const justLost = round.status === "lost" || round.status === "void";

  const buyAt = useCallback(
    (side: Side, contracts: number) => {
      const offer =
        side === "up" ? round.book.yesAsks[0] : round.book.noAsks[0];
      if (!offer) return;
      const limit =
        side === "up" ? offer.price + SLIPPAGE : 1 - offer.price - SLIPPAGE;
      round.buy(side, limit, contracts);
    },
    [round],
  );

  const start = useCallback(
    (side: Side) => {
      setBanked([]);
      setFolded(false);
      setStarted(true);
      setStake(BASE_CONTRACTS);
      buyAt(side, BASE_CONTRACTS);
    },
    [buyAt],
  );

  /** Bank the rung that just won, then stake its payout on the next window. */
  const press = useCallback(() => {
    if (!justWon || round.entryCost == null) return;
    const contracts = fromRaw(round.held);
    const cost = fromRaw(round.entryCost);
    setBanked((prev) => [...prev, { contracts, cost }]);
    // A winning contract redeems for exactly 1, so the payout in contracts is
    // the stake for the next rung.
    setStake(contracts);
    round.reset();
    buyAt(round.side ?? "up", contracts);
  }, [buyAt, justWon, round]);

  /** Both endings — folded, or broke on a rung — clear the same way. */
  const clear = useCallback(() => {
    setBanked([]);
    setFolded(false);
    setStarted(false);
    round.reset();
  }, [round]);

  const fold = useCallback(() => {
    if (justWon && round.entryCost != null) {
      const contracts = fromRaw(round.held);
      const cost = fromRaw(round.entryCost);
      setBanked((prev) => [...prev, { contracts, cost }]);
    }
    setFolded(true);
    setStarted(false);
    round.reset();
  }, [justWon, round]);

  return {
    round,
    banked,
    height: banked.length + (justWon ? 1 : 0),
    nextStake: justWon ? fromRaw(round.held) : stake,
    atRisk:
      banked.reduce((sum, r) => sum + r.cost, 0) +
      (round.entryCost != null && round.status !== "idle"
        ? fromRaw(round.entryCost)
        : 0),
    canPress: justWon && !folded,
    finished: justLost || folded,
    idle: !started && round.status === "idle",
    start,
    press,
    fold,
    clear,
  };
}
