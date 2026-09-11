"use client";

/**
 * Achievements as progress rings, surfaced in the menu.
 *
 * The reference carries a carousel of circular rings with a percentage; ours
 * shows the same shape over the same numbers the achievements screen uses —
 * `metrics()` over the wallet's real rounds. Nothing here is stored or seeded:
 * a ring is at 40% because the chain says the metric is at 40% of its
 * threshold.
 *
 * Ordered by how close each one is, so the carousel opens on what is nearly
 * won rather than on an alphabetical list of locked ones.
 */

import Image from "next/image";
import TapTarget from "@/components/ui/TapTarget";
import { ACHIEVEMENTS, achievementImage } from "@/lib/api/fixtures";
import { metrics } from "@/lib/dreamdex/achievements";
import type { Stats } from "@/lib/dreamdex/stats";

const SIZE = 72;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function AchievementRings({ stats }: { stats: Stats }) {
  const values = metrics(stats);
  const rows = ACHIEVEMENTS.map((a) => {
    const value = values[a.metric] ?? 0;
    return {
      ...a,
      progress: Math.min(1, value / a.threshold),
      unlocked: value >= a.threshold,
    };
  }).sort((a, b) => b.progress - a.progress);

  const unlocked = rows.filter((a) => a.unlocked).length;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">
          Achievements
        </h2>
        <TapTarget
          href="/menu/achievements"
          className="text-[11px] font-bold text-brand-500"
        >
          {unlocked} of {rows.length} ›
        </TapTarget>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {rows.map((a) => (
          <TapTarget
            href="/menu/achievements"
            key={a.slug}
            className="surface-skeuo rounded-card flex w-[104px] shrink-0 snap-start flex-col items-center gap-1.5 px-2 py-3"
          >
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
              <svg width={SIZE} height={SIZE} className="-rotate-90">
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke="rgba(255,255,255,.1)"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={
                    a.unlocked ? "var(--color-brand-500)" : "var(--color-text-3)"
                  }
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - a.progress)}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <Image
                  src={achievementImage(a.slug)}
                  alt=""
                  width={40}
                  height={40}
                  className={a.unlocked ? "" : "opacity-30 grayscale"}
                />
              </div>
            </div>
            <span className="tnum text-[13px] font-black leading-none">
              {Math.round(a.progress * 100)}%
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-text-3">
              {a.name}
            </span>
          </TapTarget>
        ))}
      </div>
    </section>
  );
}
