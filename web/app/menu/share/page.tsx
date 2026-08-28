"use client";

/**
 * The P&L share card.
 *
 * Composed from the shipped card art: a win/lose template, the pre-baked
 * classic console shot, and the screen plate. Picking a different settled play
 * re-renders the card.
 */

import Image from "next/image";
import { useState } from "react";
import TapTarget from "@/components/ui/TapTarget";
import { EmptyState } from "@/components/menu/MenuUI";
import { usePlays, useUser } from "@/lib/api/hooks";
import { GAME_LABELS, type GameId } from "@/lib/api/types";
import { formatUsd } from "@/lib/api/math";
import { useToast } from "@/components/ui/Toast";
import { playSfx } from "@/lib/sound";

export default function SharePage() {
  const plays = usePlays(undefined, 30);
  const user = useUser();
  const toast = useToast();
  const [index, setIndex] = useState(0);

  const settled = plays.filter((p) =>
    ["won", "lost", "cashed_out"].includes(p.status),
  );

  if (!settled.length) {
    return <EmptyState>Finish a play to make a card.</EmptyState>;
  }

  const play = settled[Math.min(index, settled.length - 1)];
  const pnl = Number(play.pnl);
  const won = pnl >= 0;
  const roi = (pnl / Number(play.stake)) * 100;

  return (
    <>
      <div
        className="relative mx-auto aspect-[1110/1650] w-full max-w-[300px] overflow-hidden rounded-3xl border border-[var(--color-line-strong)]"
        style={{
          background: won
            ? "linear-gradient(160deg, #123524 0%, #05100b 60%)"
            : "linear-gradient(160deg, #3a1512 0%, #120605 60%)",
        }}
      >
        <Image
          src={won ? "/assets/pnl-card/over-win.webp" : "/assets/pnl-card/over-lose.webp"}
          alt=""
          fill
          className="object-cover opacity-70"
          sizes="300px"
        />

        <div className="relative flex h-full flex-col p-5">
          <div className="flex items-center justify-between">
            <Image
              src="/assets/logos/toko-mark.svg"
              alt="TOKO"
              width={26}
              height={26}
              unoptimized
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              {GAME_LABELS[play.game as GameId] ?? play.game}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
              {play.status === "cashed_out" ? "Cashed out" : won ? "Won" : "Rekt"}
            </div>
            <div
              className={`mt-1 text-4xl font-black tabular-nums ${
                won ? "text-up" : "text-down"
              }`}
            >
              {formatUsd(pnl, true)}
            </div>
            <div
              className={`text-sm font-bold tabular-nums ${
                won ? "text-up" : "text-down"
              }`}
            >
              {roi >= 0 ? "+" : ""}
              {roi.toFixed(0)}% · {play.multiplier.toFixed(2)}x
            </div>
          </div>

          <div className="relative mt-2 flex-1">
            <Image
              src={
                won
                  ? "/assets/pnl-card/console-classic-win-v2.webp"
                  : "/assets/pnl-card/console-classic-rekt-v2.webp"
              }
              alt=""
              fill
              className="object-contain"
              sizes="300px"
            />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                {play.params.asset} · ${play.stake}
              </div>
              <div className="text-sm font-extrabold text-white">
                @{user.username}
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
              toko.app
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <TapTarget
          className="rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-xs font-bold text-text-2 disabled:opacity-40"
          disabled={index >= settled.length - 1}
          onClick={() => setIndex((i) => Math.min(settled.length - 1, i + 1))}
        >
          Older
        </TapTarget>
        <span className="text-xs tabular-nums text-text-3">
          {index + 1} / {settled.length}
        </span>
        <TapTarget
          className="rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-xs font-bold text-text-2 disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Newer
        </TapTarget>
      </div>

      <TapTarget
        className="mt-5 w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black"
        haptic="high"
        onClick={() => {
          playSfx("tap");
          void navigator.clipboard
            ?.writeText(
              `${formatUsd(pnl, true)} on ${GAME_LABELS[play.game as GameId] ?? play.game} — https://toko.app/@${user.username}`,
            )
            .then(() => toast("Card text copied", "win"))
            .catch(() => toast("Couldn't copy that.", "lose"));
        }}
      >
        Copy share text
      </TapTarget>
    </>
  );
}
