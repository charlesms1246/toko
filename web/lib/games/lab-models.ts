/**
 * Pricing models for the lab games.
 *
 * These five are admin-gated experiments; the shipped app fetches their curves
 * from `/games/<name>/model`. The shapes below reproduce those endpoints against
 * the same volatility model the live games use, so the lab behaves consistently
 * with Lucky and Range rather than inventing its own economics.
 */

import { HOUSE_EDGE, normalCdf, roundVol, DEFAULT_DURATION } from "@/lib/api/math";

// ── Pin: closest call wins ───────────────────────────────────────────────────

export interface PinModel {
  /** Target offsets from spot, as fractions. */
  offsets: number[];
  /** Payout for landing within `tolerance` of the called price. */
  tolerance: number;
  maxMultiplier: number;
}

export const PIN_MODEL: PinModel = {
  offsets: [-0.02, -0.012, -0.006, -0.002, 0, 0.002, 0.006, 0.012, 0.02],
  tolerance: 0.0015,
  maxMultiplier: 40,
};

/**
 * Payout falls off with how improbable the called price is: a call right at
 * spot is likely and pays little, a far call is unlikely and pays a lot.
 */
export function pinMultiplier(offset: number, duration = DEFAULT_DURATION): number {
  const vol = roundVol(duration);
  const z = Math.abs(offset) / Math.max(vol, 1e-6);
  // Probability of landing inside the tolerance band around the call.
  const band = PIN_MODEL.tolerance / Math.max(vol, 1e-6);
  const probability = Math.max(
    1e-4,
    normalCdf(z + band) - normalCdf(z - band) + (normalCdf(-z + band) - normalCdf(-z - band)),
  );
  return Math.min(
    PIN_MODEL.maxMultiplier,
    Math.max(1.05, (1 / probability) * (1 - HOUSE_EDGE)),
  );
}

// ── Snipe: fire when the wall is close ───────────────────────────────────────

export const SNIPE_MODEL = {
  /** How long the wall takes to cross, in ms. */
  travelMs: 3200,
  /** Perfect-hit window, as a fraction of travel. */
  perfect: 0.02,
  good: 0.06,
  maxMultiplier: 12,
};

/** `error` is the normalised distance from the mark when you fired. */
export function snipeMultiplier(error: number): number {
  const e = Math.abs(error);
  if (e <= SNIPE_MODEL.perfect) return SNIPE_MODEL.maxMultiplier;
  if (e >= 0.5) return 0;
  const scaled = (e - SNIPE_MODEL.perfect) / (0.5 - SNIPE_MODEL.perfect);
  return Math.max(0, SNIPE_MODEL.maxMultiplier * Math.pow(1 - scaled, 2.2));
}

// ── Press: ratchet the band tighter ──────────────────────────────────────────

export const PRESS_MODEL = {
  /** Half-width of the starting band, as a fraction of spot. */
  startHalfWidth: 0.014,
  /** Each press multiplies the payout and shrinks the band by this factor. */
  shrink: 0.72,
  maxPresses: 6,
};

export function pressBand(presses: number): number {
  return PRESS_MODEL.startHalfWidth * Math.pow(PRESS_MODEL.shrink, presses);
}

export function pressMultiplier(presses: number, duration = DEFAULT_DURATION): number {
  const vol = roundVol(duration);
  const half = pressBand(presses);
  const z = half / Math.max(vol, 1e-6);
  const probability = Math.max(1e-4, 2 * normalCdf(z) - 1);
  return Math.max(1.02, (1 / probability) * (1 - HOUSE_EDGE));
}

// ── Rush: take the deal or push ──────────────────────────────────────────────

export interface RushDeal {
  multiplier: number;
  /** Chance the next push improves the offer rather than busting it. */
  survival: number;
  round: number;
}

export const RUSH_MODEL = {
  baseMultiplier: 1.35,
  growth: 1.55,
  /** Survival decays as the offer grows. */
  survivalDecay: 0.82,
  baseSurvival: 0.86,
  maxRounds: 7,
};

export function rushDeal(round: number, appetite = 1): RushDeal {
  const multiplier =
    RUSH_MODEL.baseMultiplier * Math.pow(RUSH_MODEL.growth * appetite, round);
  const survival =
    RUSH_MODEL.baseSurvival * Math.pow(RUSH_MODEL.survivalDecay, round);
  return { multiplier, survival, round };
}

// ── Breakout: call the break before it happens ───────────────────────────────

export const BREAKOUT_MODEL = {
  /** Break thresholds, as fractions of spot. */
  thresholds: [0.002, 0.004, 0.007, 0.011, 0.016, 0.022],
  maxMultiplier: 30,
};

/** Pays for the price breaking *through* the threshold in either direction. */
export function breakoutMultiplier(
  threshold: number,
  duration = DEFAULT_DURATION,
): number {
  const vol = roundVol(duration);
  const z = threshold / Math.max(vol, 1e-6);
  // Two-sided break probability.
  const probability = Math.max(1e-4, 2 * (1 - normalCdf(z)));
  return Math.min(
    BREAKOUT_MODEL.maxMultiplier,
    Math.max(1.05, (1 / probability) * (1 - HOUSE_EDGE)),
  );
}
