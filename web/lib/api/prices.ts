/**
 * Price feed — Somnia's on-chain EMA oracle.
 *
 * This module used to be a mean-reverting random walk. It now reads the real
 * oracle through the markets SDK and keeps the same tiny surface, so everything
 * downstream (`useSpot`, `usePriceHistory`, the sparklines) got real prices
 * without changing.
 *
 * `watchPrices` resolves in well under a second and arrives with ~100 ticks of
 * history already in the store, so `priceHistory` is useful immediately. Between
 * first render and that first delivery `spot` reports 0 — call `start()` early
 * (the app does, in `providers.tsx`) so it has happened before any screen that
 * shows a price is reached.
 */

import { getClient } from "@/lib/dreamdex/client";

/** Assets we keep a live feed for. All four are carried by the oracle. */
export const ALL_ASSETS = ["BTC", "ETH", "SOMI", "SOL"];

/** Assets offered in the game picker. */
export const TRADABLE_ASSETS = ["BTC", "ETH", "SOMI"];

/** Only BTC / ETH / SOMI have logo art. */
export const ASSET_LOGOS: Record<string, string | undefined> = {
  BTC: "/assets/images/coins/btc-logo.png",
  ETH: "/assets/images/coins/eth-logo.png",
  SOMI: "/assets/images/coins/somnia-logo.png",
};

export interface PricePoint {
  t: number;
  p: number;
}

const HISTORY_POINTS = 120;
/** How often we resample the live store into a snapshot for React. */
const POLL_MS = 400;

const listeners = new Set<() => void>();
/** Immutable per-tick copies, so `useSyncExternalStore` sees a stable reference. */
const snapshots = new Map<string, PricePoint[]>();
const latest = new Map<string, number>();

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

function sample() {
  const client = getClient();
  if (!client) return;
  let changed = false;

  for (const asset of ALL_ASSETS) {
    const live = client.getLivePrice(asset);
    if (live && live.price !== latest.get(asset)) {
      latest.set(asset, live.price);
      changed = true;
    }
    const ticks = client.getLivePriceTicks(asset, { limit: HISTORY_POINTS }) as
      | { blockTimestamp?: number; timestamp?: number; price: number }[]
      | undefined;
    if (ticks?.length) {
      const previous = snapshots.get(asset);
      // `ticks` is newest-first, `previous` is oldest-first, so the newest of
      // each are at opposite ends.
      const newest = ticks[0].price;
      if (!previous || previous.length !== ticks.length ||
          previous[previous.length - 1]?.p !== newest) {
        // The feed hands ticks back newest-first; charts want oldest-first, or
        // the line is drawn backwards in time.
        snapshots.set(
          asset,
          ticks
            .map((tick) => ({
              t: (tick.blockTimestamp ?? tick.timestamp ?? 0) * 1000,
              p: tick.price,
            }))
            .reverse(),
        );
        changed = true;
      }
    }
  }

  if (changed) listeners.forEach((fn) => fn());
}

/** Open the oracle feed. Safe to call repeatedly; the SDK ref-counts the watch. */
export function start(): void {
  if (started || typeof window === "undefined") return;
  const client = getClient();
  if (!client) return;
  started = true;
  void client.watchPrices(ALL_ASSETS).then(sample).catch(() => {
    // The socket heals itself; the poll below picks the feed up when it does.
  });
  timer ??= setInterval(sample, POLL_MS);
}

/** Latest oracle price, or 0 before the first delivery. */
export function spot(asset: string): number {
  start();
  return latest.get(asset) ?? 0;
}

/** Recent oracle ticks — a stable reference until the feed moves. */
export function priceHistory(asset: string): PricePoint[] {
  start();
  return snapshots.get(asset) ?? EMPTY;
}

const EMPTY: PricePoint[] = [];

/** Subscribe to feed movement, for `useSyncExternalStore`. */
export function subscribeTick(fn: () => void): () => void {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
