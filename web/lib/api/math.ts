/**
 * The pricing model, ported from the client-side simulator that shipped with
 * the app. It mirrors the server, so the numbers on screen here are the same
 * numbers the real backend would quote.
 */

// ── Distributions ────────────────────────────────────────────────────────────

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Standard normal CDF (Zelen & Severo approximation). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const density = 0.39894228 * Math.exp((-x * x) / 2) * poly;
  return x >= 0 ? 1 - density : density;
}

/** Inverse normal CDF (Acklam's rational approximation). */
export function normalInv(p: number): number {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687,
    138.357751867269, -30.66479806614716, 2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= 1 - low) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// ── Shared constants ─────────────────────────────────────────────────────────

/** Default round length, in seconds. */
export const DEFAULT_DURATION = 30;
export const DURATIONS = [10, 30, 60];

/** Base 30-second volatility. */
export const BASE_VOL = 0.022;

/** Minimum strike offset, so a 2x is never exactly at the money. */
export const MIN_OFFSET = 0.0015;

/** `pending` -> `open`. */
export const CONFIRM_MS = 850;
/** Settle price is latched this long before expiry. */
export const SETTLE_LOCK_MS = 5000;
/** Suspense window after expiry before the result flips. */
export const SUSPENSE_MS = 900;

// ── Lucky ────────────────────────────────────────────────────────────────────

export interface MultiplierRung {
  mult: number;
  weight: number;
  z: number;
}

/**
 * The z-score is the multiplier's inverse-normal distance, so the implied win
 * probability matches the payout: 2x sits at the money, 10x is 1.28 sigma out.
 */
export const LUCKY_MULTS: MultiplierRung[] = [
  { mult: 2, weight: 0.5, z: 0 },
  { mult: 3, weight: 0.3, z: 0.4307 },
  { mult: 5, weight: 0.13, z: 0.8416 },
  { mult: 10, weight: 0.07, z: 1.2816 },
];

export const LUCKY_LADDER = LUCKY_MULTS.map((m) => m.mult);

export function luckyZ(mult: number): number {
  return LUCKY_MULTS.find((m) => m.mult === mult)?.z ?? 0;
}

// ── Moonshot ─────────────────────────────────────────────────────────────────

/** Moonshot reaches further than Lucky — 25x exists only here. */
export const MOONSHOT_REACH_Z: Record<number, number> = {
  2: 0,
  3: 0.4307,
  5: 0.8416,
  10: 1.2816,
  25: 1.7507,
};

export const MOONSHOT_LADDER = [2, 3, 5, 10, 25];

export function moonshotZ(reach: number): number {
  if (MOONSHOT_REACH_Z[reach] != null) return MOONSHOT_REACH_Z[reach];
  let z = 0;
  for (const level of Object.keys(MOONSHOT_REACH_Z)
    .map(Number)
    .sort((x, y) => x - y)) {
    if (reach >= level) z = MOONSHOT_REACH_Z[level];
  }
  return z;
}

/** Volatility scaled to the round length. */
export function roundVol(duration: number): number {
  return BASE_VOL * Math.sqrt(duration / DEFAULT_DURATION);
}

/** Where the price has to get to for a directional play to pay. */
export function strikeFor(
  spot: number,
  side: "up" | "down",
  z: number,
  duration: number,
): number {
  const vol = roundVol(duration);
  return spot * (1 + (side === "up" ? 1 : -1) * Math.max(vol * z, MIN_OFFSET));
}

/**
 * House edge for the remaining simulated lab experiments. Kept when Range was
 * dropped because `lib/games/lab-models.ts` prices against it.
 */
export const HOUSE_EDGE = 0.04;

// ── Stake ladder ─────────────────────────────────────────────────────────────

export const STAKE_CONFIG = {
  minStake: 1.5,
  maxStake: 25,
  maxStakeAdmin: 1000,
  houseEdgeBps: 0,
  houseEdgeMinNetUsd: 1.2,
};

export const BASE_LADDER = [1, 5, 10, 25, 50, 100, 500, 1000];

/**
 * Keep the rungs inside [min, max], always include both ends, and fall back to
 * four evenly spaced values if too few survive.
 */
export function buildLadder(min: number, max: number): number[] {
  const inside = BASE_LADDER.filter((v) => v >= min && v <= max);
  const rungs = new Set<number>([min, ...inside, max]);
  const sorted = [...rungs].sort((a, b) => a - b);
  if (sorted.length >= 4) return sorted;
  return [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
}

// ── Mark to market ───────────────────────────────────────────────────────────

export interface MarkInput {
  game: string;
  stake: number;
  entry: number;
  lockedMult: number;
  openedMs: number;
  expiryMs: number;
  side?: "up" | "down";
  target?: number;
  roundVol?: number;
  lower?: number;
  upper?: number;
}

export interface MarkResult {
  markValue: number;
  pnl: number;
  multiplier: number;
  win: boolean;
}

/**
 * What the ticket is worth right now.
 *
 * Directional games price the ticket as probability-weighted, so cashing out
 * early is fair rather than pro-rata. Range instead ramps value up while the
 * price stays inside the band and bleeds it toward a 5% salvage floor outside.
 */
export function markToMarket(
  play: MarkInput,
  price: number,
  now = Date.now(),
): MarkResult {
  if (play.game === "lucky" || play.game === "moonshot") {
    const normalized =
      ((play.side === "up" ? 1 : -1) * (price - (play.target ?? play.entry))) /
      play.entry;
    const remaining = clamp01(
      (play.expiryMs - now) / Math.max(1, play.expiryMs - play.openedMs),
    );
    const probability = clamp01(
      normalCdf(
        normalized /
          ((play.roundVol ?? BASE_VOL) * Math.sqrt(Math.max(remaining, 8e-4))),
      ),
    );
    const markValue = play.stake * play.lockedMult * probability;
    return {
      markValue,
      pnl: markValue - play.stake,
      multiplier: play.lockedMult,
      win: normalized >= 0,
    };
  }

  // Every remaining simulated game is directional, so the band branch that used
  // to serve Range is gone with it.
  return { markValue: play.stake, pnl: 0, multiplier: play.lockedMult, win: false };
}

// ── Formatting ───────────────────────────────────────────────────────────────

export const money = (value: number) => value.toFixed(2);

export function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

export function formatUsd(value: number, sign = false): string {
  const prefix = sign && value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}
