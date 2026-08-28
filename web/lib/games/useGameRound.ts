"use client";

/**
 * Shared round lifecycle for the staking games.
 *
 * Owns the current play id, adopts an in-flight play on mount, exposes the
 * countdown, and wraps opening/cashing out with the balance check that triggers
 * the chip grant when the player is broke.
 */

import { useCallback, useEffect, useState } from "react";
import {
  useCountdown,
  usePlay,
  useRestorePlay,
  useStoreActions,
} from "@/lib/api/hooks";
import { InsufficientBalance } from "@/lib/api/store";
import type { GameId, Play } from "@/lib/api/types";
import { useToast } from "@/components/ui/Toast";

export interface GameRound {
  play: Play | undefined;
  /** True between "pending" and a terminal status. */
  live: boolean;
  settled: boolean;
  secsLeft: number;
  remainingMs: number;
  progress: number;
  /** Run an opener; surfaces the grant flow if the balance is too low. */
  open: (fn: () => Play) => void;
  cashOut: () => void;
  clear: () => void;
  /** Set when the last attempt failed for lack of chips. */
  needsChips: boolean;
  dismissChips: () => void;
}

const TERMINAL = ["won", "lost", "cashed_out", "error"];

export function useGameRound(game: GameId): GameRound {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [needsChips, setNeedsChips] = useState(false);
  const actions = useStoreActions();
  const toast = useToast();

  // Fall back to whatever is still in flight for this game, so a reload or a
  // trip through the menu lands you back on the live round.
  const restored = useRestorePlay(game);
  const playId = openedId ?? restored?.id ?? null;
  const play = usePlay(playId);

  const settled = !!play && TERMINAL.includes(play.status);
  const live = !!play && !settled;

  const { secsLeft, remainingMs } = useCountdown(
    live ? play?.market.expiry : null,
  );

  const openedMs = play ? Date.parse(play.openedAt) : 0;
  const total = play ? Math.max(1, play.market.expiry - openedMs) : 1;
  const progress = play ? Math.min(1, Math.max(0, 1 - remainingMs / total)) : 0;

  // Let the result sit for a few seconds, then return the screen to idle.
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(() => setOpenedId(null), 4000);
    return () => clearTimeout(timer);
  }, [settled, playId]);

  const open = useCallback(
    (fn: () => Play) => {
      try {
        const next = fn();
        setOpenedId(next.id);
        setNeedsChips(false);
      } catch (error) {
        if (error instanceof InsufficientBalance) {
          const granted = actions.requestGrant();
          if (granted.granted) {
            toast("You're topped up! $100 in chips.", "win");
          } else {
            setNeedsChips(true);
          }
          return;
        }
        toast("Something went wrong opening that play.", "lose");
      }
    },
    [actions, toast],
  );

  const cashOut = useCallback(() => {
    if (playId) actions.cashOut(playId);
  }, [actions, playId]);

  return {
    play,
    live,
    settled,
    secsLeft,
    remainingMs,
    progress,
    open,
    cashOut,
    clear: () => setOpenedId(null),
    needsChips,
    dismissChips: () => setNeedsChips(false),
  };
}
