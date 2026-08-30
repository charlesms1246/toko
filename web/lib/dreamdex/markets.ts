"use client";

/**
 * Live Event Contract windows.
 *
 * Shannon runs 1m, 5m, 1h, 4h and 24h series for BTC and ETH. The 1m series is
 * the one the console plays: exactly 60 seconds wide, resolved by the real
 * oracle the moment it expires.
 *
 * Two rules from Phase 0 are load-bearing here:
 *
 * - **Key by `marketId`, never by pool.** Pools recycle across windows *and*
 *   across assets — one pool was observed serving a BTC market and then an ETH
 *   market twelve minutes later.
 * - **`strike` can be `"0"` on a market already `Trading`** — it is stamped at
 *   roll time, so treat it as absent rather than as a price of zero.
 */

import { getClient } from "./client";

export interface Window {
  marketId: string;
  poolAddress: string;
  asset: string;
  /** "1m", "5m", "1h", … */
  interval: string;
  intervalSec: number;
  /** Unix seconds. */
  expiry: number;
  tradingStart: number;
  /** Raw oracle strike, or null when not yet stamped. */
  strike: number | null;
  status: string;
  yesTokenId: string;
  noTokenId: string;
}

export interface MarketsState {
  windows: Window[];
  loading: boolean;
  error: string | null;
  /** When the list was last refreshed. */
  at: number;
}

const SERVER_STATE: MarketsState = { windows: [], loading: false, error: null, at: 0 };

let state: MarketsState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<MarketsState>) {
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

/** The oracle answers in 2 decimals — `7769330` is 77693.30. */
export const STRIKE_DECIMALS = 2;
export const formatStrike = (strike: number) =>
  (strike / 10 ** STRIKE_DECIMALS).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWindow(m: any): Window {
  const strike = Number(m.strike);
  return {
    marketId: m.marketId,
    poolAddress: m.poolAddress,
    asset: m.asset,
    interval: m.interval ?? `${m.intervalSec}s`,
    intervalSec: Number(m.intervalSec),
    expiry: Number(m.expiry),
    tradingStart: Number(m.tradingStart),
    strike: Number.isFinite(strike) && strike > 0 ? strike : null,
    status: m.status,
    yesTokenId: m.yesTokenId,
    noTokenId: m.noTokenId,
  };
}

export async function load(): Promise<void> {
  const client = getClient();
  if (!client) return;
  set({ loading: true, error: null });
  try {
    const live = await client.listLiveBinaryMarkets();
    const windows = (live as unknown[])
      .map(toWindow)
      .sort((a, b) => a.expiry - b.expiry || a.asset.localeCompare(b.asset));
    set({ windows, loading: false, at: Date.now() });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Could not read markets",
    });
  }
}

let poll: ReturnType<typeof setInterval> | null = null;

/**
 * Keep the window list fresh. A 1m window rolls every minute, so this refreshes
 * often enough to pick up the successor without hammering the indexer.
 */
export function startPolling(everyMs = 5000): () => void {
  void load();
  poll ??= setInterval(() => void load(), everyMs);
  return () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  };
}

/** Seconds until a window locks. Negative once it has. */
export const secondsLeft = (w: Window) => w.expiry - Date.now() / 1000;

/** Windows of one cadence, soonest first. */
export const ofInterval = (windows: Window[], intervalSec: number) =>
  windows.filter((w) => w.intervalSec === intervalSec);

/**
 * The window closing next — what the console counts down to.
 *
 * `minSecsLeft` asks for one with room to spare, which is what a challenge needs:
 * an offer that stands for thirty minutes has to be posted in a window that
 * outlasts it. Omit `intervalSec` to search every series, so a long offer can
 * find a long window without the caller mapping durations to series by hand.
 */
export function nextToClose(
  windows: Window[],
  intervalSec?: number,
  minSecsLeft = 0,
): Window | null {
  const pool = intervalSec ? ofInterval(windows, intervalSec) : windows;
  return pool.filter((w) => secondsLeft(w) > minSecsLeft)[0] ?? null;
}
