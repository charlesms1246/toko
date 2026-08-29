"use client";

import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useEffect, useSyncExternalStore } from "react";
import { useUser } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import * as statsStore from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";
import { formatUsd } from "@/lib/api/math";
import { useToast } from "@/components/ui/Toast";

export default function AccountPage() {
  const user = useUser();
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const { stats } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
    void statsStore.load();
  }, []);
  const toast = useToast();
  const netPnl = stats.netPnl;

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
        <StatTile label="Plays" value={String(stats.played)} />
        <StatTile
          label="Win rate"
          value={`${(stats.winRate * 100).toFixed(0)}%`}
        />
        <StatTile
          label="Net P&L"
          value={formatUsd(netPnl, true)}
          tone={netPnl >= 0 ? "up" : "down"}
        />
        <StatTile label="Volume" value={`$${stats.volume.toFixed(2)}`} />
        <StatTile label="Best streak" value={String(stats.maxStreak)} tone="brand" />
        <StatTile
          label="Best multiple"
          value={`${stats.bestMultiple.toFixed(2)}x`}
          tone="brand"
        />
      </div>

      <MenuSection title="Profile">
        <MenuRow label="Handle" value={`@${user.username}`} href="/menu/username" />
        <MenuRow
          label="Favourite game"
          value={stats.assets.join(", ") || "—"}
        />
        <MenuRow
          label="Playing since"
          value={stats.firstAt ? new Date(stats.firstAt).toLocaleDateString() : "—"}
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
        <MenuRow label="Balance" value={`$${formatCollateral(walletState.collateral)} tUSDC`} />
      </MenuSection>
    </>
  );
}
