"use client";

import { ScreenRoot } from "@/components/screen/Screen";

/** The score board shown between runs of a free minigame. */
export default function MinigameBoard({
  title,
  best,
  lastScore,
}: {
  title: string;
  best: number;
  lastScore: number | null;
}) {

  return (
    <ScreenRoot className="gap-2">
      <div className="text-center text-sm font-black tracking-tight text-text">
        {title}
      </div>

      {lastScore != null && (
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
            Run over
          </div>
          <div className="text-2xl font-black tabular-nums text-brand-500">
            {lastScore}
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-text-3">
          Your best
        </span>
        <span className="font-bold tabular-nums text-text">{best}</span>
      </div>

      <div className="space-y-1 border-t border-[var(--color-line)] pt-1.5">
              </div>

      <div className="pt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        Press play to start
      </div>
    </ScreenRoot>
  );
}
