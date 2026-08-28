"use client";

import { EmptyState } from "@/components/menu/MenuUI";
import GameIcon from "@/components/games/GameIcon";
import { usePlays } from "@/lib/api/hooks";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, type GameId } from "@/lib/api/types";
import { formatUsd } from "@/lib/api/math";

const STATUS_LABEL: Record<string, string> = {
  won: "Won",
  lost: "Lost",
  cashed_out: "Cashed out",
  open: "Live",
  pending: "Opening",
  error: "Error",
};

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function HistoryPage() {
  const plays = usePlays(undefined, 60);

  if (!plays.length) return <EmptyState>No plays yet.</EmptyState>;

  return (
    <div className="space-y-2">
      {plays.map((play) => {
        const pnl = Number(play.pnl);
        const live = play.status === "open" || play.status === "pending";
        const known =
          LIVE_GAMES.includes(play.game) || LAB_GAMES.includes(play.game);
        return (
          <div
            key={play.id}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white/[.03] px-4 py-3"
          >
            <span className="text-text-2">
              {known ? (
                <GameIcon game={play.game as GameId} size={22} />
              ) : (
                <span className="text-lg">🎮</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">
                {GAME_LABELS[play.game as GameId] ?? play.game}
                <span className="ml-1.5 font-semibold text-text-3">
                  {play.params.asset}
                </span>
              </div>
              <div className="text-[11px] text-text-3">
                {STATUS_LABEL[play.status] ?? play.status} ·{" "}
                {play.multiplier.toFixed(2)}x · {relative(play.openedAt)}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-sm font-black tabular-nums ${
                  live ? "text-brand-500" : pnl >= 0 ? "text-up" : "text-down"
                }`}
              >
                {formatUsd(pnl, true)}
              </div>
              <div className="text-[11px] tabular-nums text-text-3">
                ${play.stake}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
