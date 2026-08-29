"use client";

/**
 * What this wallet has actually done on chain, rung by rung.
 *
 * Every row is a real round rebuilt from fills — see `lib/dreamdex/stats.ts`.
 */

import { useEffect, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/menu/MenuUI";
import { useRequireAdmin } from "@/lib/games/lab";
import { explorerTx } from "@/lib/dreamdex/config";
import * as statsStore from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";

export default function UsagePage() {
  const admin = useRequireAdmin();
  const { stats, at } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void statsStore.load();
  }, []);

  if (!admin) return null;
  if (!at) return <EmptyState>Reading the chain…</EmptyState>;
  if (!stats.rounds.length) return <EmptyState>No rounds yet.</EmptyState>;

  return (
    <div className="p-4">
      <div className="mb-4 text-sm font-bold">
        {stats.played} rounds · {stats.wins}W / {stats.losses}L · $
        {stats.volume.toFixed(2)} volume
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)]">
        {stats.rounds.map((r) => (
          <a
            key={r.marketAddress}
            href={explorerTx(r.txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5 text-xs last:border-b-0 hover:bg-white/[.04]"
          >
            <span className="w-12 font-bold">{r.asset}</span>
            <span className={r.side === 0 ? "w-12 text-up" : "w-12 text-down"}>
              {r.side === 0 ? "UP" : "DOWN"}
            </span>
            <span className="flex-1 tabular-nums text-text-3">
              {r.contracts.toFixed(2)} @ {r.entryPrice.toFixed(3)}
            </span>
            <span
              className={`tabular-nums font-bold ${
                r.won === null ? "text-text-3" : r.won ? "text-up" : "text-down"
              }`}
            >
              {r.won === null ? "live" : `${r.pnl >= 0 ? "+" : "−"}$${Math.abs(r.pnl).toFixed(2)}`}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
