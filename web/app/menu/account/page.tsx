"use client";

import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useStats, useUser } from "@/lib/api/hooks";
import { formatUsd } from "@/lib/api/math";
import { GAME_LABELS, type GameId } from "@/lib/api/types";
import { useToast } from "@/components/ui/Toast";

export default function AccountPage() {
  const user = useUser();
  const stats = useStats();
  const toast = useToast();
  const netPnl = Number(stats.netPnl);

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-xl font-black text-black">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold">
            @{user.username}
          </div>
          <div className="text-xs text-text-3">
            Signed in with {user.provider}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <StatTile label="Plays" value={String(stats.gamesPlayed)} />
        <StatTile
          label="Win rate"
          value={`${(stats.winRate * 100).toFixed(0)}%`}
        />
        <StatTile
          label="Net P&L"
          value={formatUsd(netPnl, true)}
          tone={netPnl >= 0 ? "up" : "down"}
        />
        <StatTile label="Volume" value={`$${stats.totalVolume}`} />
        <StatTile label="Best streak" value={String(stats.maxStreak)} tone="brand" />
        <StatTile
          label="Best multiple"
          value={`${stats.bestMultiplier}x`}
          tone="brand"
        />
      </div>

      <MenuSection title="Profile">
        <MenuRow label="Handle" value={`@${user.username}`} href="/menu/username" />
        <MenuRow
          label="Favourite game"
          value={GAME_LABELS[stats.favoriteGame as GameId] ?? stats.favoriteGame}
        />
        <MenuRow
          label="Playing since"
          value={new Date(stats.firstPlayAt).toLocaleDateString()}
        />
      </MenuSection>

      <MenuSection title="Wallet">
        <MenuRow
          label="Address"
          value={`${user.address.slice(0, 8)}…${user.address.slice(-6)}`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(user.address)
              .then(() => toast("Address copied"))
              .catch(() => toast("Couldn't copy that address.", "lose"));
          }}
        />
        <MenuRow label="Network" value="Somnia testnet" />
        <MenuRow label="Chips" value={`$${user.balance} USDC`} />
      </MenuSection>
    </>
  );
}
