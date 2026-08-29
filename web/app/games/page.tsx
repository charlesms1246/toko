"use client";

/** The game picker. The knob scrolls the list; Play launches the selection. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgramConsole } from "@/lib/console/controls";
import { ScreenRoot, ScreenHeader } from "@/components/screen/Screen";
import GameIcon from "@/components/games/GameIcon";
import { GAME_TAGLINES } from "@/lib/api/fixtures";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, MINIGAMES } from "@/lib/api/types";
import { useBalance, useIsAdmin } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { playSfx } from "@/lib/sound";

const MINIGAME_LABELS: Record<string, string> = {
  "line-rider": "Line Rider",
  "flappy-piper": "Flappy Piper",
};

export default function GamesPage() {
  const router = useRouter();
  const balance = useBalance();
  const admin = useIsAdmin();
  const [index, setIndex] = useState(0);

  const entries = [
    ...LIVE_GAMES.map((id) => ({ id, href: `/games/${id}`, label: GAME_LABELS[id], tagline: GAME_TAGLINES[id], lab: false })),
    ...MINIGAMES.map((id) => ({ id, href: `/games/${id}`, label: MINIGAME_LABELS[id], tagline: "Free to play. Chase the high score.", lab: false })),
    ...(admin
      ? LAB_GAMES.map((id) => ({ id, href: `/games/${id}`, label: GAME_LABELS[id], tagline: GAME_TAGLINES[id], lab: true }))
      : []),
  ];

  const clamped = Math.min(index, entries.length - 1);
  const active = entries[clamped];

  useEffect(() => {
    playSfx("swipe");
  }, [clamped]);

  useProgramConsole({
    main: {
      label: "PLAY",
      pulse: true,
      onPress: () => router.push(active.href),
    },
    knob: {
      min: 0,
      max: entries.length - 1,
      step: 1,
      value: clamped,
      label: "GAME",
      onChange: setIndex,
    },
    status: { left: "SELECT GAME", right: `$${formatCollateral(balance)}` },
  });

  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader left="Games" right={`${clamped + 1}/${entries.length}`} />

      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="text-brand-500">
          {LIVE_GAMES.includes(active.id as never) ||
          LAB_GAMES.includes(active.id as never) ? (
            <GameIcon game={active.id as never} size={40} />
          ) : (
            <span className="text-4xl">🏁</span>
          )}
        </div>
        <div className="text-xl font-black tracking-tight text-text">
          {active.label}
        </div>
        <p className="px-2 text-[11px] font-semibold leading-snug text-text-2">
          {active.tagline}
        </p>
        {active.lab && (
          <span className="rounded-full border border-[var(--color-premium-500)] px-2 py-[2px] text-[9px] font-bold uppercase tracking-widest text-[var(--color-premium-500)]">
            Lab
          </span>
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-1">
        {entries.map((entry, i) => (
          <span
            key={entry.id}
            className={`h-1 rounded-full transition-all ${
              i === clamped ? "w-4 bg-brand-500" : "w-1 bg-white/25"
            }`}
          />
        ))}
      </div>
    </ScreenRoot>
  );
}
