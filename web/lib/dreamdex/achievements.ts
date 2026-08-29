"use client";

/**
 * Achievements, earned from the wallet's real record.
 *
 * Every metric below is computed from actual on-chain rounds — see
 * `lib/dreamdex/stats.ts`. Nothing is stored, so there is no unlock state to
 * fall out of sync: an achievement is unlocked exactly when the chain says the
 * thing happened.
 *
 * Definitions that could not be computed honestly were removed rather than
 * approximated: "Close Call" needed a settlement price against the strike, and
 * the oracle reports an outcome, not a margin.
 */

import type { Round, Stats } from "./stats";

const DAY = 86_400_000;
const dayKey = (ms: number) => Math.floor(ms / DAY);

function maxPerDay(rounds: Round[]): number {
  const counts = new Map<number, number>();
  for (const r of rounds) {
    const k = dayKey(r.at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts.size ? Math.max(...counts.values()) : 0;
}

function longestDayStreak(rounds: Round[]): number {
  const days = [...new Set(rounds.map((r) => dayKey(r.at)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Two rounds inside ten minutes of each other. */
function hasDoublePlay(rounds: Round[]): boolean {
  const times = rounds.map((r) => r.at).sort((a, b) => a - b);
  return times.some((t, i) => i > 0 && t - times[i - 1] <= 10 * 60_000);
}

/** A win immediately following a loss, in settlement order. */
function hasComeback(rounds: Round[]): boolean {
  const settled = rounds.filter((r) => r.won !== null).sort((a, b) => a.at - b.at);
  return settled.some((r, i) => i > 0 && r.won && settled[i - 1].won === false);
}

/** Metric values, all real. Keys match `ACHIEVEMENTS[].metric`. */
export function metrics(stats: Stats): Record<string, number> {
  const r = stats.rounds;
  const hours = r.map((x) => new Date(x.at).getHours());
  return {
    games_played: stats.played,
    wins: stats.wins,
    volume: stats.volume,
    win_streak: stats.maxStreak,
    day_streak: longestDayStreak(r),
    plays_in_day: maxPerDay(r),
    night_plays: hours.filter((h) => h >= 22).length,
    early_plays: hours.filter((h) => h < 9).length,
    tiny_stake: r.some((x) => x.cost > 0 && x.cost <= 2) ? 1 : 0,
    cashed_out: r.filter((x) => x.soldEarly).length,
    settled_wins: r.filter((x) => x.won && !x.soldEarly).length,
    double_play: hasDoublePlay(r) ? 1 : 0,
    distinct_assets: stats.assets.length,
    comeback: hasComeback(r) ? 1 : 0,
  };
}
