"use client";

/**
 * Operator view of this wallet's real trading record.
 *
 * There is no house and no server, so there is nothing global to administer —
 * what an operator can actually see is the same on-chain record the player sees,
 * plus the venue-wide activity the leaderboard samples.
 */

import { useEffect, useSyncExternalStore } from "react";
import { EmptyState, MenuSection, MenuRow, StatTile } from "@/components/menu/MenuUI";
import { explorerAddress } from "@/lib/dreamdex/config";
import * as statsStore from "@/lib/dreamdex/stats";
import * as leaderboard from "@/lib/dreamdex/leaderboard";
import * as wallet from "@/lib/dreamdex/wallet";
import { useStoreActions, useIsAdmin } from "@/lib/api/hooks";

export default function AdminPage() {
  const actions = useStoreActions();
  const admin = useIsAdmin();
  const { stats, at } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );
  const board = useSyncExternalStore(
    leaderboard.subscribe,
    leaderboard.getSnapshot,
    leaderboard.getServerSnapshot,
  );
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void statsStore.load();
    void leaderboard.load();
  }, []);

  if (!at) return <EmptyState>Reading the chain…</EmptyState>;

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-2">
        <StatTile label="Rounds" value={String(stats.played)} />
        <StatTile
          label="Win rate"
          value={`${(stats.winRate * 100).toFixed(0)}%`}
          tone="up"
        />
        <StatTile
          label="Net P&L"
          value={`${stats.netPnl >= 0 ? "+" : "−"}$${Math.abs(stats.netPnl).toFixed(2)}`}
          tone={stats.netPnl >= 0 ? "up" : "down"}
        />
      </div>

      <MenuSection title="This wallet">
        <MenuRow label="Volume" value={`$${stats.volume.toFixed(2)}`} />
        <MenuRow label="Best multiple" value={`${stats.bestMultiple.toFixed(2)}x`} />
        <MenuRow label="Longest streak" value={String(stats.maxStreak)} />
        <MenuRow label="Assets" value={stats.assets.join(", ") || "—"} />
        <MenuRow label="tUSDC" value={wallet.formatCollateral(walletState.collateral)} />
        <MenuRow label="Gas" value={`${wallet.formatGas(walletState.gas)} STT`} />
        {walletState.address && (
          <MenuRow
            label="On explorer"
            value="↗"
            href={explorerAddress(walletState.address)}
            external
          />
        )}
      </MenuSection>

      <MenuSection title={`Venue sample · ${board.pools} pools`}>
        <MenuRow label="Traders seen" value={String(board.rows.length)} />
        <MenuRow
          label="Volume"
          value={`$${board.rows.reduce((s, r) => s + r.volume, 0).toFixed(2)}`}
        />
        <MenuRow
          label="Fills"
          value={String(board.rows.reduce((s, r) => s + r.trades, 0))}
        />
      </MenuSection>

      <MenuSection title="Device">
        <MenuRow
          label="Admin mode"
          value={admin ? "on" : "off"}
          onClick={() => actions.setAdmin(!admin)}
        />
      </MenuSection>
    </>
  );
}
