"use client";

import Panel from "@/components/shell/Panel";
import { MenuSection } from "@/components/menu/MenuUI";
import GameIcon from "@/components/games/GameIcon";
import { usePlays } from "@/lib/api/hooks";
import { useRequireAdmin } from "@/lib/games/lab";
import {
  GAME_LABELS,
  LAB_GAMES,
  LIVE_GAMES,
  type GameId,
} from "@/lib/api/types";
import { formatUsd } from "@/lib/api/math";

export default function UsagePage() {
  const admin = useRequireAdmin();
  const plays = usePlays(undefined, 500);

  const games = [...LIVE_GAMES, ...LAB_GAMES] as GameId[];
  const rows = games
    .map((game) => {
      const forGame = plays.filter((p) => p.game === game);
      const settled = forGame.filter(
        (p) => p.status !== "open" && p.status !== "pending",
      );
      const wins = settled.filter(
        (p) => p.status === "won" || p.status === "cashed_out",
      ).length;
      return {
        game,
        plays: forGame.length,
        volume: forGame.reduce((s, p) => s + Number(p.stake), 0),
        pnl: settled.reduce((s, p) => s + Number(p.pnl), 0),
        winRate: settled.length ? wins / settled.length : 0,
      };
    })
    .sort((a, b) => b.plays - a.plays);

  return (
    <Panel
      title="Usage"
      backHref="/admin"
      screenLabel="Usage"
      status={{ left: "USAGE", right: `${plays.length} PLAYS` }}
    >
      {!admin ? (
        <p className="py-10 text-center text-sm text-text-3">
          Admin access only.
        </p>
      ) : (
        <MenuSection title="Per game">
          {rows.map((row) => (
            <div
              key={row.game}
              className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0"
            >
              <span className="text-brand-500">
                <GameIcon game={row.game} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {GAME_LABELS[row.game]}
                </div>
                <div className="text-[11px] tabular-nums text-text-3">
                  {row.plays} plays · ${row.volume.toFixed(0)} ·{" "}
                  {(row.winRate * 100).toFixed(0)}% win
                </div>
              </div>
              <span
                className={`text-sm font-black tabular-nums ${
                  row.pnl >= 0 ? "text-up" : "text-down"
                }`}
              >
                {formatUsd(row.pnl, true)}
              </span>
            </div>
          ))}
        </MenuSection>
      )}
    </Panel>
  );
}
