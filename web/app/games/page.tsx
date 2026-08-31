"use client";

/**
 * The hub.
 *
 * A list, not a carousel. The carousel showed one game at a time and made you
 * turn the knob blind to find the others; a console this small still has room
 * to show the whole roster at once, which is how you choose something.
 *
 * The knob scrolls it, PREV/NEXT step it, and the rows are tappable — the same
 * selection driven three ways, because a handheld should answer to whichever
 * one your thumb reaches for.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgramConsole } from "@/lib/console/controls";
import { ScreenRoot } from "@/components/screen/Screen";
import GameIcon from "@/components/games/GameIcon";
import { GAME_TAGLINES } from "@/lib/api/fixtures";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, MINIGAMES } from "@/lib/api/types";
import { useBalance, useIsAdmin } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { playSfx } from "@/lib/sound";
import * as demo from "@/lib/demo";

const MINIGAME_LABELS: Record<string, string> = {
  "line-rider": "Line Rider",
  "flappy-piper": "Flappy Piper",
};

const pad = (n: number) => String(n).padStart(2, "0");

interface Entry {
  id: string;
  href: string;
  label: string;
  tagline: string;
  minigame: boolean;
  lab: boolean;
}

export default function GamesPage() {
  const router = useRouter();
  const balance = useBalance();
  const admin = useIsAdmin();
  const [index, setIndex] = useState(0);
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const paper = demo.isActive();
  const openPlay = paper && demo.hasOpenPlay();

  const entries: Entry[] = [
    ...LIVE_GAMES.map((id) => ({
      id,
      href: `/games/${id}`,
      label: GAME_LABELS[id],
      tagline: GAME_TAGLINES[id],
      minigame: false,
      lab: false,
    })),
    ...(admin
      ? LAB_GAMES.map((id) => ({
          id,
          href: `/games/${id}`,
          label: GAME_LABELS[id],
          tagline: GAME_TAGLINES[id],
          minigame: false,
          lab: true,
        }))
      : []),
    ...MINIGAMES.map((id) => ({
      id,
      href: `/games/${id}`,
      label: MINIGAME_LABELS[id],
      tagline: "Chase your own best. No stake.",
      minigame: true,
      lab: false,
    })),
  ];

  const clamped = Math.min(index, entries.length - 1);
  const active = entries[clamped];
  const firstMinigame = entries.findIndex((e) => e.minigame);

  // Skip the first pass: on mount the list is already at the top, and scrolling
  // row 0 "into view" hides the section heading above it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    playSfx("swipe");
    rowsRef.current[clamped]?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  const step = (to: number) =>
    setIndex(Math.max(0, Math.min(entries.length - 1, to)));

  useProgramConsole({
    main: { label: "PLAY", pulse: true, onPress: () => router.push(active.href) },
    action1: { label: "PREV", onPress: () => step(clamped - 1) },
    action2: { label: "NEXT", onPress: () => step(clamped + 1) },
    knob: {
      min: 0,
      max: entries.length - 1,
      step: 1,
      value: clamped,
      label: "SELECT",
      format: (v) => `${pad(v + 1)}/${pad(entries.length)}`,
      onChange: step,
    },
    status: { left: "SELECT GAME", right: `$${formatCollateral(balance)}` },
  });

  return (
    <ScreenRoot>
      <div className="flex items-center justify-between pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              paper ? "bg-brand-500" : "bg-up"
            }`}
          />
          <span className="truncate">{paper ? "Demo" : "Live"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pl-3">
          <span className="text-text-3">Available</span>
          <span className="tabular-nums font-bold text-text">
            ${formatCollateral(balance)}
          </span>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section
          title="Select game"
          hint={openPlay ? "You have a round open" : "Tap or turn the knob"}
        />
        {entries.map((entry, i) => {
          const head = i === firstMinigame;
          return (
            <div key={entry.id}>
              {head && <Section title="Minigame" hint="Just for fun · No stake" />}
              <button
                ref={(el) => {
                  rowsRef.current[i] = el;
                }}
                type="button"
                onClick={() =>
                  i === clamped ? router.push(entry.href) : setIndex(i)
                }
                className="relative flex w-full items-center gap-2.5 py-1.5 pl-3 text-left"
              >
                {i === clamped && (
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" />
                )}
                <span
                  className={`tabular-nums w-4 shrink-0 font-mono text-[11px] font-bold ${
                    i === clamped ? "text-brand-500" : "text-text-3"
                  }`}
                >
                  {pad(i + 1)}
                </span>
                {!entry.minigame && (
                  <span
                    className={i === clamped ? "text-brand-500" : "text-text-3"}
                  >
                    <GameIcon game={entry.id as never} size={16} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] font-extrabold uppercase leading-tight tracking-[0.02em] ${
                      i === clamped ? "text-text" : "text-text-2"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="block truncate font-mono text-[9px] uppercase leading-tight tracking-[0.06em] text-text-3">
                    {entry.tagline}
                  </span>
                </span>
                {entry.lab && (
                  <span className="shrink-0 border border-[var(--color-premium-500)] px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-premium-500)]">
                    Lab
                  </span>
                )}
                <span
                  className={`shrink-0 font-mono text-sm ${
                    i === clamped ? "text-brand-500" : "text-text-3/40"
                  }`}
                >
                  ›
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </ScreenRoot>
  );
}

function Section({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 pt-2 pb-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-text-3">
      <span>{title}</span>
      <span className="truncate tracking-[0.08em]">{hint}</span>
    </div>
  );
}
