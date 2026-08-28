"use client";

/**
 * Everything that layers over the console: the ordered onboarding gates, the
 * cross-page active-play pill, the onboarding tour, and the settle toasts.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "./Onboarding";
import Tour from "./Tour";
import ActivePlayPill from "./ActivePlayPill";
import { useSettleListener } from "@/lib/api/hooks";
import { useToast } from "@/components/ui/Toast";
import { GAME_LABELS, type GameId } from "@/lib/api/types";
import haptics from "@/lib/haptics";
import {
  playAchievement,
  playCashOut,
  playLose,
  playWin,
  resumeAudio,
} from "@/lib/sound";
import { ACHIEVEMENTS } from "@/lib/api/fixtures";
import * as onboarding from "@/lib/onboarding";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();

  const { onboarded, tourSeen } = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );

  useEffect(() => {
    onboarding.hydrate();
  }, []);

  const finishOnboarding = useCallback(() => {
    onboarding.completeOnboarding();
    resumeAudio();
    router.push("/games");
  }, [router]);

  useSettleListener((play, unlocked) => {
    const label = GAME_LABELS[play.game as GameId] ?? play.game;
    const pnl = Number(play.pnl);
    const sign = pnl >= 0 ? "+" : "-";
    toast(
      `${label} settled — ${sign}$${Math.abs(pnl).toFixed(2)}`,
      pnl >= 0 ? "win" : "lose",
    );

    if (play.status === "cashed_out") {
      playCashOut();
      haptics.outcome("cashOut");
    } else if (play.status === "won") {
      playWin();
      haptics.outcome("win");
    } else {
      playLose();
      haptics.outcome("lose");
    }

    for (const slug of unlocked) {
      const def = ACHIEVEMENTS.find((a) => a.slug === slug);
      if (!def) continue;
      setTimeout(() => {
        toast(`Achievement unlocked — ${def.name}`, "win");
        playAchievement();
        haptics.outcome("achievement");
      }, 700);
    }
  });

  return (
    <>
      {children}
      <ActivePlayPill />
      {!onboarded && <Onboarding onDone={finishOnboarding} />}
      {onboarded && !tourSeen && <Tour onDone={onboarding.completeTour} />}
    </>
  );
}
