/**
 * Price feed.
 *
 * A mean-reverting random walk with momentum and occasional jumps, anchored to
 * a seed price per asset. It ticks every 300ms and keeps a rolling 60-second
 * history — the same window the console's sparkline reads from.
 */

export const SEED_PRICES: Record<string, number> = {
  BTC: 63575,
  ETH: 1725,
  SOL: 71.45,
  SOMI: 0.71,
  DEEP: 0.0166,
};

export const ALL_ASSETS = Object.keys(SEED_PRICES);
/** Assets offered in the game picker. */
export const TRADABLE_ASSETS = ["BTC", "ETH", "SOMI"];

/** Only BTC / ETH / SOMI have logo art. */
export const ASSET_LOGOS: Record<string, string | undefined> = {
  BTC: "/assets/images/coins/btc-logo.png",
  ETH: "/assets/images/coins/eth-logo.png",
  SOMI: "/assets/images/coins/somnia-logo.png",
};

const TICK_MS = 300;
const NOISE = 4e-4;
const MOMENTUM_DECAY = 0.92;
const DRIFT_PULL = 0.018;
const MAX_STEP = 0.003;
const JUMP_PROB = 0.08;
const JUMP_SIZE = 0.005;
const JUMP_DECAY = 0.3;
const MAX_DEVIATION = 0.08;
const HISTORY_MS = 60_000;

export interface PricePoint {
  t: number;
  p: number;
}

const anchor = new Map<string, number>();
const current = new Map<string, number>();
const deviation = new Map<string, number>();
const momentum = new Map<string, number>();
const jump = new Map<string, number>();
const history = new Map<string, PricePoint[]>();
const listeners = new Map<string, Set<(price: number) => void>>();
/**
 * Immutable per-tick copies of the history, so `useSyncExternalStore` sees a
 * stable reference between ticks instead of a fresh array on every read.
 */
const historySnapshot = new Map<string, PricePoint[]>();
const tickListeners = new Set<() => void>();

let timer: ReturnType<typeof setInterval> | null = null;

function ensure(asset: string) {
  if (current.has(asset)) return;
  const seed = SEED_PRICES[asset] ?? 1;
  anchor.set(asset, seed);
  current.set(asset, seed);
  deviation.set(asset, 0);
  momentum.set(asset, 0);
  jump.set(asset, 0);
  history.set(asset, []);
  historySnapshot.set(asset, []);
}

function record(asset: string, price: number, now: number) {
  const points = history.get(asset)!;
  points.push({ t: now, p: price });
  const cutoff = now - HISTORY_MS;
  while (points.length && points[0].t < cutoff) points.shift();
}

function step() {
  const now = Date.now();
  for (const asset of ALL_ASSETS) {
    ensure(asset);
    const base = anchor.get(asset)!;

    let m = (momentum.get(asset) ?? 0) * MOMENTUM_DECAY +
      (Math.random() - 0.5) * 2 * NOISE;
    if (m > MAX_STEP) m = MAX_STEP;
    else if (m < -MAX_STEP) m = -MAX_STEP;
    momentum.set(asset, m);

    let dev = (deviation.get(asset) ?? 0) + m;
    dev -= dev * DRIFT_PULL;
    if (dev > MAX_DEVIATION) dev = MAX_DEVIATION;
    else if (dev < -MAX_DEVIATION) dev = -MAX_DEVIATION;
    deviation.set(asset, dev);

    let j = (jump.get(asset) ?? 0) * JUMP_DECAY;
    if (Math.random() < JUMP_PROB) {
      j += (Math.random() < 0.5 ? -1 : 1) * JUMP_SIZE;
    }
    jump.set(asset, j);

    const next = base * (1 + dev + j);
    const price = next > 0 ? next : base;
    current.set(asset, price);
    record(asset, price, now);
    historySnapshot.set(asset, history.get(asset)!.slice());
    listeners.get(asset)?.forEach((fn) => fn(price));
  }
  tickListeners.forEach((fn) => fn());
}

function start() {
  if (timer || typeof window === "undefined") return;
  for (const asset of ALL_ASSETS) ensure(asset);
  timer = setInterval(step, TICK_MS);
}

/** Latest price for an asset, starting the feed on first use. */
export function spot(asset: string): number {
  ensure(asset);
  start();
  return current.get(asset)!;
}

/** Rolling 60-second history — a stable reference until the next tick. */
export function priceHistory(asset: string): PricePoint[] {
  ensure(asset);
  start();
  return historySnapshot.get(asset)!;
}

/** Subscribe to every tick, for `useSyncExternalStore`. */
export function subscribeTick(fn: () => void): () => void {
  start();
  tickListeners.add(fn);
  return () => {
    tickListeners.delete(fn);
  };
}

/** Subscribe to ticks. Returns an unsubscribe function. */
export function subscribePrice(
  asset: string,
  fn: (price: number) => void,
): () => void {
  ensure(asset);
  start();
  let set = listeners.get(asset);
  if (!set) {
    set = new Set();
    listeners.set(asset, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}
