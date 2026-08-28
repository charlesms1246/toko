"use client";

import { useState } from "react";
import { useLeaderboard } from "@/lib/api/hooks";
import { GAME_LABELS, LIVE_GAMES, type GameId } from "@/lib/api/types";
import { formatUsd } from "@/lib/api/math";
import { playSfx } from "@/lib/sound";

export default function LeaderboardPage() {
  const [game, setGame] = useState<GameId | "all">("all");
  const rows = useLeaderboard(game === "all" ? undefined : game);

  return (
    <>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {(["all", ...LIVE_GAMES] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              playSfx("tap");
              setGame(id);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              game === id
                ? "bg-brand-500 text-black"
                : "border border-[var(--color-line-strong)] text-text-2"
            }`}
          >
            {id === "all" ? "All" : GAME_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)]">
        {rows.slice(0, 25).map((row) => (
          <div
            key={`${row.rank}-${row.handle}`}
            className={`flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0 ${
              row.isYou ? "bg-brand-500/10" : ""
            }`}
          >
            <span
              className={`w-6 text-sm font-black tabular-nums ${
                row.rank <= 3 ? "text-brand-500" : "text-text-3"
              }`}
            >
              {row.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-sm font-bold ${
                  row.isYou ? "text-brand-500" : "text-text"
                }`}
              >
                {row.handle}
                {row.isYou && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-widest">
                    you
                  </span>
                )}
              </div>
              <div className="text-[11px] tabular-nums text-text-3">
                {row.plays} plays · ${row.volume} volume
              </div>
            </div>
            <span
              className={`text-sm font-black tabular-nums ${
                Number(row.pnl) >= 0 ? "text-up" : "text-down"
              }`}
            >
              {formatUsd(Number(row.pnl), true)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
