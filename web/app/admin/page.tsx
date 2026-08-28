"use client";

import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import GameIcon from "@/components/games/GameIcon";
import { useMarkets, usePlays, useStats } from "@/lib/api/hooks";
import { formatPrice, formatUsd } from "@/lib/api/math";
import { GAME_LABELS, LIVE_GAMES } from "@/lib/api/types";

export default function AdminDashboard() {
  const stats = useStats();
  const plays = usePlays(undefined, 200);
  const markets = useMarkets();

  const open = plays.filter(
    (p) => p.status === "open" || p.status === "pending",
  ).length;
  const volume = plays.reduce((sum, p) => sum + Number(p.stake), 0);
  const house = plays
    .filter((p) => p.status !== "open" && p.status !== "pending")
    .reduce((sum, p) => sum - Number(p.pnl), 0);

  const byGame = LIVE_GAMES.map((game) => {
    const rows = plays.filter((p) => p.game === game);
    const wins = rows.filter((p) => p.status === "won").length;
    return {
      game,
      count: rows.length,
      wins,
      volume: rows.reduce((s, p) => s + Number(p.stake), 0),
    };
  });

  const maxCount = Math.max(1, ...byGame.map((row) => row.count));

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <StatTile label="Plays" value={String(plays.length)} />
        <StatTile label="Open now" value={String(open)} tone="brand" />
        <StatTile label="Volume" value={`$${volume.toFixed(0)}`} />
        <StatTile
          label="House P&L"
          value={formatUsd(house, true)}
          tone={house >= 0 ? "up" : "down"}
        />
      </div>

      <MenuSection title="By game">
        <div className="space-y-3 p-4">
          {byGame.map((row) => (
            <div key={row.game}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-brand-500">
                  <GameIcon game={row.game} size={16} />
                </span>
                <span className="flex-1 text-xs font-bold">
                  {GAME_LABELS[row.game]}
                </span>
                <span className="text-xs tabular-nums text-text-3">
                  {row.count} · ${row.volume.toFixed(0)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(row.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Markets">
        {markets.map((market) => (
          <MenuRow
            key={market.asset}
            label={market.asset}
            value={`$${formatPrice(market.spot)}`}
          />
        ))}
      </MenuSection>

      <MenuSection title="Player">
        <MenuRow label="Games played" value={String(stats.gamesPlayed)} />
        <MenuRow
          label="Win rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
        />
        <MenuRow label="Net P&L" value={formatUsd(Number(stats.netPnl), true)} />
      </MenuSection>

      <MenuSection title="Reports">
        <MenuRow label="Usage" href="/usage" />
        <MenuRow label="Performance" href="/perf" />
        <MenuRow label="Errors" href="/errors" />
      </MenuSection>
    </>
  );
}
