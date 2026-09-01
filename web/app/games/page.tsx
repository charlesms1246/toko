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
      <div className="flex items-center justify-between pb-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-text-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="relative inline-flex h-2 w-2 shrink-0">
            <span
              className={`absolute inset-0 animate-ping ${
                paper ? "bg-brand-500/70" : "bg-up/70"
              }`}
            />
            <span
              className={`relative inline-block h-2 w-2 ${
                paper ? "bg-brand-500" : "bg-up"
              }`}
            />
          </span>
          <span className="truncate">{paper ? "Demo" : "Live"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pl-3">
          <span className="text-text-3">Available</span>
          <span className="tnum font-bold text-text">
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
              {head && (
                <>
                  <span className="mt-3 block h-px w-full bg-[var(--color-line-strong)]" />
                  <Section title="Minigame" hint="Just for fun · No stake" />
                </>
              )}
              <button
                ref={(el) => {
                  rowsRef.current[i] = el;
                }}
                type="button"
                onClick={() =>
                  i === clamped ? router.push(entry.href) : setIndex(i)
                }
                className="relative flex w-full items-center gap-3 py-2.5 pl-3 text-left"
              >
                {i === clamped && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-brand-500" />
                )}
                <span
                  className={`tnum w-5 shrink-0 font-mono text-[14px] font-bold ${
                    i === clamped ? "text-brand-500" : "text-text-3"
                  }`}
                >
                  {pad(i + 1)}
                </span>
                {!entry.minigame && (
                  <span
                    className={`shrink-0 ${
                      i === clamped ? "text-brand-500" : "text-text-3"
                    }`}
                  >
                    <GameIcon game={entry.id as never} size={20} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate uppercase leading-tight tracking-[0.02em] ${
                      entry.minigame
                        ? "text-[15px] font-bold"
                        : "text-[18px] font-extrabold"
                    } ${i === clamped ? "text-text" : "text-text-2"}`}
                  >
                    {entry.label}
                  </span>
                  <span className="marquee-mask block truncate font-mono text-[11px] uppercase leading-tight tracking-[0.08em] text-text-3">
                    {entry.tagline}
                  </span>
                </span>
                {openPlay && i === clamped && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 border border-up/60 bg-up/15 px-1.5 py-1 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-up">
                    <span className="h-1.5 w-1.5 bg-up motion-safe:animate-pulse" />
                    In play
                  </span>
                )}
                {entry.lab && (
                  <span className="shrink-0 border border-[var(--color-premium-500)] px-1 py-px font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-premium-500)]">
                    Lab
                  </span>
                )}
                <span
                  className={`shrink-0 font-mono ${
                    entry.minigame ? "text-sm" : "text-lg"
                  } ${i === clamped ? "text-brand-500" : "text-text-3/40"}`}
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
    <div className="flex items-baseline justify-between gap-2 pb-0.5 pt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-text-3">
      <span>{title}</span>
      <span className="truncate tracking-[0.1em]">{hint}</span>
    </div>
  );
}
