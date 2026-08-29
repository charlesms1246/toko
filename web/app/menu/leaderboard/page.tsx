"use client";

/**
 * The venue's most active traders — real addresses, real volume.
 *
 * There is no venue-wide fills endpoint, so this aggregates the fills from the
 * pools serving recent windows. It is an honest sample, and the footer says how
 * wide that sample is rather than implying it is the whole venue.
 */

import { useEffect, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/menu/MenuUI";
import { explorerAddress } from "@/lib/dreamdex/config";
import * as leaderboard from "@/lib/dreamdex/leaderboard";
import * as wallet from "@/lib/dreamdex/wallet";

export default function LeaderboardPage() {
  const state = useSyncExternalStore(
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
    void leaderboard.load();
  }, []);

  const me = walletState.address?.toLowerCase();

  if (!state.at && !state.error) {
    return <EmptyState>Reading the venue…</EmptyState>;
  }

  return (
    <>
      {state.error && (
        <p className="mb-4 rounded-2xl border border-[var(--color-line)] px-4 py-3 text-[11px] text-down">
          {state.error}
        </p>
      )}

      {state.rows.length === 0 ? (
        <EmptyState>No fills in the sampled windows yet.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-line)]">
          {state.rows.map((row) => {
            const isYou = row.address === me;
            return (
              <a
                key={row.address}
                href={explorerAddress(row.address)}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0 transition hover:bg-white/[.04] ${
                  isYou ? "bg-brand-500/10" : ""
                }`}
              >
                <span className="w-6 text-sm font-black tabular-nums text-text-3">
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-2">
                  {isYou ? "You" : `${row.address.slice(0, 10)}…${row.address.slice(-4)}`}
                </span>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums">
                    ${row.volume.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-text-3">
                    {row.trades} fill{row.trades === 1 ? "" : "s"}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-text-3">
        Volume traded across the {state.pools} most recent pools, taker and maker
        side alike. The venue has no account-wide fills feed, so this is a sample
        of live windows rather than all-time totals.
      </p>
    </>
  );
}
