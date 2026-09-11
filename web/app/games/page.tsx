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

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useProgramConsole } from "@/lib/console/controls";
import { Footer, Shell } from "@/components/screen/GameScreen";
import GameIcon from "@/components/games/GameIcon";
import { GAME_TAGLINES } from "@/lib/api/fixtures";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, MINIGAMES } from "@/lib/api/types";
import { useBalance, useBalanceRead, useIsAdmin } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { playSfx } from "@/lib/sound";
import * as demo from "@/lib/demo";
import * as markets from "@/lib/dreamdex/markets";
import { useUser } from "@/lib/api/hooks";
import { COLLATERAL } from "@/lib/dreamdex/config";

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
  const balanceRead = useBalanceRead();
  const admin = useIsAdmin();
  const user = useUser();
  const [index, setIndex] = useState(0);
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * The mode row's right slot.
   *
   * The reference shows a live player count there. We have no presence service
   * and will not invent one, so the slot carries the other thing that is
   * genuinely live and genuinely ours to know: how many windows the venue has
   * open right now. Until the first poll lands there is no reading, and it says
   * how many games there are instead of guessing.
   */
  const venue = useSyncExternalStore(
    markets.subscribe,
    markets.getSnapshot,
    markets.getServerSnapshot,
  );
  useEffect(() => markets.startPolling(), []);

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
      // Inverted against the index, exactly as the reference's own hub does it.
      // The hardware convention is "drag up, value up"; on a list, up means
      // *up the list*, so the knob counts the other way and the two agree.
      value: entries.length - 1 - clamped,
      label: "SELECT",
      format: (v) => `${pad(entries.length - v)}/${pad(entries.length)}`,
      onChange: (v) => step(entries.length - 1 - v),
    },
  });

  return (
    <Shell
      mode={
        venue.at === 0
          ? `${entries.length} games`
          : `${venue.windows.length} window${venue.windows.length === 1 ? "" : "s"} open`
      }
    >
      {/* The mode row is `Shell`'s now — this screen had its own copy of it. */}
      <div className="flex min-h-0 flex-1 flex-col px-[var(--screen-rim,24px)]">

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section
          title="Select game"
          /*
           * An open round CANNOT be attributed to a game.
           *
           * The demo ledger is keyed by market, and the same market is reachable
           * from Lucky, Snipe, Press and Duel — so there is no game to point at.
           * Two "In play" chips used to claim otherwise: one on the highlighted
           * row, which made the tag follow the cursor down the list, and one
           * beside the handle, which said a username was in play. Both are gone.
           * The fact is true of the player, not of a row, so it is stated once,
           * here. Menu -> Positions is where an open round actually lives.
           */
          hint={openPlay ? "You have a round open" : "Tap or turn the knob"}
        />
        {entries.map((entry, i) => {
          const on = i === clamped;
          const head = i === firstMinigame;
          /* Filled while selected, as the reference marks its own list. */
          const marker = (
            <span
              className={`shrink-0 font-mono ${
                entry.minigame ? "text-[9px]" : "text-[11px]"
              } ${on ? "text-brand-500" : "text-text-3/40"}`}
            >
              {on ? "\u25B6" : "\u203A"}
            </span>
          );
          const row = (
            <button
              ref={(el) => {
                rowsRef.current[i] = el;
              }}
              type="button"
              onClick={() =>
                on ? router.push(entry.href) : setIndex(i)
              }
              className={`relative flex w-full items-center text-left ${
                entry.minigame ? "gap-2 py-1.5 pl-3" : "gap-3 py-2.5 pl-3"
              } ${on ? "bg-brand-500/[0.13]" : ""}`}
            >
              {on && (
                <span className="absolute inset-y-0 left-0 w-1 bg-brand-500" />
              )}
              {entry.minigame ? (
                /*
                 * One line, no number, smaller: the layout says these are not
                 * the main event, so no section heading has to say it.
                 */
                <>
                  <span
                    className={`shrink-0 text-[13px] font-bold uppercase leading-tight tracking-[0.02em] ${
                      on ? "text-text" : "text-text-2"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-text-3">
                    {entry.tagline}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`tnum w-5 shrink-0 font-mono text-[14px] font-bold ${
                      on ? "text-brand-500" : "text-text-3"
                    }`}
                  >
                    {pad(i + 1)}
                  </span>
                  <span
                    className={`shrink-0 ${
                      on ? "text-brand-500" : "text-text-3"
                    }`}
                  >
                    <GameIcon game={entry.id as never} size={26} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[18px] font-extrabold uppercase leading-tight tracking-[0.02em] ${
                        on ? "text-text" : "text-text-2"
                      }`}
                    >
                      {entry.label}
                    </span>
                    <span className="marquee-mask block truncate font-mono text-[11px] uppercase leading-tight tracking-[0.08em] text-text-3">
                      {entry.tagline}
                    </span>
                  </span>
                  {entry.lab && (
                    <span className="shrink-0 border border-[var(--color-premium-500)] px-1 py-px font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-premium-500)]">
                      Lab
                    </span>
                  )}
                </>
              )}
              {marker}
            </button>
          );
          return (
            <div key={entry.id}>
              {head && (
                <span className="mt-3 mb-1 block h-px w-full bg-[var(--color-line-strong)]" />
              )}
              {row}
            </div>
          );
        })}
      </div>
      </div>

      <Footer>
          <div className="flex items-center gap-2.5">
            <span className="min-w-0 truncate text-[17px] font-extrabold lowercase leading-tight tracking-[0.02em] text-text">
              {user.handle ? `@${user.handle}` : "your rig"}
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">
            Available
          </div>
          <div className="mt-0.5 leading-none">
            <span className="tnum text-[26px] font-extrabold tracking-tight text-text">
              {/* A dash until the chain has answered. `0n` is what the store
                  holds both before the first read and for an empty wallet, and
                  printing it made a wallet with 497 tUSDC read $0.00 for a
                  second on every load. */}
              {balanceRead ? `$${formatCollateral(balance)}` : "—"}
            </span>
            <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
              {COLLATERAL.symbol}
            </span>
          </div>
      </Footer>
    </Shell>
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
