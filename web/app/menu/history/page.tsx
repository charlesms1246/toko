"use client";

/**
 * Round history — every round this wallet has played, rebuilt from its fills.
 */

import { useEffect, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/menu/MenuUI";
import { explorerTx } from "@/lib/dreamdex/config";
import * as statsStore from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";

export default function HistoryPage() {
  const { stats, at, error } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void statsStore.load();
  }, []);

  if (error) {
    return (
      <p className="surface-skeuo rounded-card px-4 py-3 text-[13px] font-bold text-down">
        {error}
      </p>
    );
  }
  if (!at) return <EmptyState>Reading the chain…</EmptyState>;
  if (!stats.rounds.length) {
    return <EmptyState>No rounds yet. Play a window to make one.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {stats.rounds.map((r) => (
        <a
          key={r.marketAddress}
          href={explorerTx(r.txHash)}
          target="_blank"
          rel="noreferrer"
          className="surface-skeuo rounded-card flex items-center gap-3 p-4 transition-transform active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">
              {r.asset}{" "}
              <span className={r.side === 0 ? "text-up" : "text-down"}>
                {r.side === 0 ? "UP" : "DOWN"}
              </span>
              {r.soldEarly && (
                <span className="ml-2 text-[11px] text-text-3">sold early</span>
              )}
            </div>
            <div className="text-[11px] text-text-3">
              {r.contracts.toFixed(2)} @ {r.entryPrice.toFixed(3)} ·{" "}
              {r.won === null ? "live" : r.voided ? "voided" : r.won ? "won" : "lost"}
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-sm font-black tabular-nums ${
                r.won === null ? "text-text-2" : r.pnl >= 0 ? "text-up" : "text-down"
              }`}
            >
              {r.won === null
                ? `$${r.cost.toFixed(2)}`
                : `${r.pnl >= 0 ? "+" : "−"}$${Math.abs(r.pnl).toFixed(2)}`}
            </div>
            <div className="text-[11px] text-text-3">
              {new Date(r.at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
