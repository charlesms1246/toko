"use client";

/**
 * Who is actually trading this venue.
 *
 * There is no venue-wide fills endpoint — `getFills` is pool-scoped — so this
 * fans out across the pools serving recent windows and aggregates the fills by
 * address. Every row is a real trader with real volume; nobody is invented.
 *
 * Pools recycle across windows *and* across assets, so a pool is only a place
 * fills happened, never an identity. That is fine here: we aggregate by the
 * trader's address, not by market.
 */

import { getClient } from "./client";
import { COLLATERAL } from "./config";

const ONE = 10 ** COLLATERAL.decimals;
/** Bounded fan-out: enough pools to be representative, few enough to stay quick. */
const POOLS = 8;

export interface LeaderRow {
  address: string;
  trades: number;
  volume: number;
  rank: number;
}

interface LeaderboardState {
  rows: LeaderRow[];
  loading: boolean;
  error: string | null;
  at: number;
  /** How many pools the numbers below were drawn from. */
  pools: number;
}

const SERVER_STATE: LeaderboardState = {
  rows: [],
  loading: false,
  error: null,
  at: 0,
  pools: 0,
};

let state: LeaderboardState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<LeaderboardState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

export async function load(): Promise<void> {
  set({ loading: true, error: null });
  try {
    const client = getClient();
    if (!client) {
      set({ loading: false, error: "Not connected" });
      return;
    }

    const markets = (await client.listBinaryMarkets({ limit: 60 })) as unknown[];
    const pools = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...new Set(markets.map((m: any) => m.poolAddress).filter(Boolean)),
    ].slice(0, POOLS) as string[];

    const tally = new Map<string, { trades: number; volume: number }>();

    await Promise.all(
      pools.map(async (pool) => {
        try {
          const fills = (await client.getFills(pool, { limit: 500 })) as unknown[];
          for (const f of fills) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fill = f as any;
            const value = Number(fill.quoteQuantity) / ONE;
            for (const who of [fill.taker, fill.maker]) {
              if (!who) continue;
              const key = String(who).toLowerCase();
              const entry = tally.get(key) ?? { trades: 0, volume: 0 };
              entry.trades += 1;
              entry.volume += value;
              tally.set(key, entry);
            }
          }
        } catch {
          // Skip a pool that will not read rather than failing the whole board.
        }
      }),
    );

    const rows = [...tally.entries()]
      .map(([address, v]) => ({ address, ...v, rank: 0 }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 25)
      .map((row, i) => ({ ...row, rank: i + 1 }));

    set({ rows, loading: false, at: Date.now(), pools: pools.length });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Could not read the board",
    });
  }
}
