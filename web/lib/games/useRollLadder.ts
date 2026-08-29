"use client";

/**
 * The roll ladder — Press and Breakout.
 *
 * A rung is one real Minute round. Win it and the payout becomes the stake for
 * the next rung, so the multiple compounds across consecutive windows; lose a
 * rung and the ladder ends with it. Folding stops and keeps what the last rung
 * paid.
 *
 * This is what "tighten the band, or fold" and "call the break before it
 * happens" become on a venue with one strike per window: you cannot buy a band,
 * but you can stake a win on the next window, and that is the same ratchet.
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
import { useMinuteRound, type MinuteRound, type Side } from "./useMinuteRound";

export interface Rung {
  /** Contracts staked into this rung. */
  contracts: number;
  /** Collateral paid for it, tUSDC. */
  cost: number;
}

export interface RollLadder {
  round: MinuteRound;
  /** Rungs already won and pressed on, oldest first. */
  banked: Rung[];
  /** Rungs won back to back, including the one just settled. */
  height: number;
  /** Contracts the next press would stake. */
  nextStake: number;
  /** Collateral put into the ladder so far, tUSDC. */
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
}

const BASE_CONTRACTS = 1;
const SLIPPAGE = 0.02;

/**
 * @param lockSide Breakout rolls the *same* direction each rung — that is what
 *   makes it a call on continuation rather than a fresh bet each time.
 */
export function useRollLadder(lockSide: boolean): RollLadder {
  const round = useMinuteRound();
  const [banked, setBanked] = useState<Rung[]>([]);
  const [stake, setStake] = useState(BASE_CONTRACTS);
  const [lockedSide, setLockedSide] = useState<Side | null>(null);
  const [folded, setFolded] = useState(false);
  const [started, setStarted] = useState(false);

  const justWon = round.status === "won";
  const justLost = round.status === "lost" || round.status === "void";

  const buyAt = useCallback(
    (side: Side, contracts: number) => {
      const offer = side === "up" ? round.book.yesAsks[0] : round.book.noAsks[0];
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
      setLockedSide(lockSide ? side : null);
      buyAt(side, BASE_CONTRACTS);
    },
    [buyAt, lockSide],
  );

  /** Bank the rung that just won, then stake its payout on the next window. */
  const press = useCallback(() => {
    if (!justWon || round.entryCost == null) return;
    const contracts = Number(round.held) / 1e6;
    const cost = Number(round.entryCost) / 1e6;
    setBanked((prev) => [...prev, { contracts, cost }]);
    // A winning contract redeems for exactly 1, so the payout in contracts is
    // the stake for the next rung.
    setStake(contracts);
    const side = lockedSide ?? round.side ?? "up";
    round.reset();
    buyAt(side, contracts);
  }, [buyAt, justWon, lockedSide, round]);

  const fold = useCallback(() => {
    if (justWon && round.entryCost != null) {
      const contracts = Number(round.held) / 1e6;
      const cost = Number(round.entryCost) / 1e6;
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
    nextStake: justWon ? Number(round.held) / 1e6 : stake,
    atRisk: banked.reduce((sum, r) => sum + r.cost, 0),
    canPress: justWon && !folded,
    finished: justLost || folded,
    idle: !started && round.status === "idle",
    start,
    press,
    fold,
  };
}
