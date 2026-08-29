"use client";

/**
 * Achievements, earned from the wallet's real on-chain record.
 *
 * Nothing is stored: each one is recomputed from actual rounds, so an
 * achievement is unlocked exactly when the chain says the thing happened.
 */

import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/menu/MenuUI";
import { ACHIEVEMENTS, achievementImage } from "@/lib/api/fixtures";
import { metrics } from "@/lib/dreamdex/achievements";
import * as stats from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";

export default function AchievementsPage() {
  const state = useSyncExternalStore(
    stats.subscribe,
    stats.getSnapshot,
    stats.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void stats.load();
  }, []);

  if (!state.at && !state.error) {
    return <EmptyState>Reading your record…</EmptyState>;
  }

  const values = metrics(state.stats);
  const rows = ACHIEVEMENTS.map((a) => {
    const value = values[a.metric] ?? 0;
    return {
      ...a,
      value,
      unlocked: value >= a.threshold,
      progress: Math.min(1, value / a.threshold),
      image: achievementImage(a.slug),
    };
  });
  const unlocked = rows.filter((a) => a.unlocked).length;

  return (
    <>
      {state.error && (
        <p className="mb-4 rounded-2xl border border-[var(--color-line)] px-4 py-3 text-[11px] text-down">
          {state.error}
        </p>
      )}

      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-bold">
          {unlocked} of {rows.length}
        </span>
        <span className="text-xs text-text-3">
          {state.stats.played} round{state.stats.played === 1 ? "" : "s"} played
        </span>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${(unlocked / rows.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {rows.map((a) => (
          <div
            key={a.slug}
            className="flex flex-col items-center rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-3 text-center"
            title={`${a.description} — ${a.value}/${a.threshold}`}
          >
            <Image
              src={a.image}
              alt=""
              width={56}
              height={56}
              className={a.unlocked ? "" : "opacity-30 grayscale"}
            />
            <div
              className={`mt-2 text-[11px] font-bold leading-tight ${
                a.unlocked ? "text-text" : "text-text-3"
              }`}
            >
              {a.name}
            </div>
            {!a.unlocked && a.progress > 0 && (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-text-3"
                  style={{ width: `${a.progress * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
