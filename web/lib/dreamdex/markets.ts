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
import { createPoller } from "./poller";
import { ALL_ASSETS } from "@/lib/api/prices";

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
/** The strike as a plain number, for plotting against the price feed. */
export const strikePrice = (strike: number) => strike / 10 ** STRIKE_DECIMALS;

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

const poller = createPoller();

/**
 * Keep the window list fresh. A 1m window rolls every minute, so this refreshes
 * often enough to pick up the successor without hammering the indexer.
 *
 * Six screens share this one poll, so the interval is refcounted: it stops when
 * the last of them unmounts, not the first.
 */
export function startPolling(everyMs = 5000): () => void {
  return poller.track("markets", everyMs, load);
}

/** Seconds until a window locks. Negative once it has. */
export const secondsLeft = (w: Window) => w.expiry - Date.now() / 1000;

/**
 * The shortest live series with enough runway — the round the console plays.
 *
 * The venue's series are **not fixed**. Shannon ran 1-minute windows for months
 * and then stopped rolling them; a few minutes later the 5-minute series stopped
 * too, leaving 15m as the shortest thing trading. Meanwhile new venues appeared
 * running their own cadences, including some odd ones (31s, 115s, 507s).
 *
 * So the console asks for the shortest round available rather than naming one.
 * A minute is the ideal and the game is designed around it, but hardcoding it
 * meant every trading game sat on "finding a window" the moment the venue moved
 * on — which is a worse product than a slightly longer round.
 *
 * `skip` carries markets already caught with nothing resting. Depth does not
 * follow the series here — the maker that quoted the old 1m book is not
 * necessarily quoting whatever is live now — so a window can look perfectly
 * tradeable and return `ImmediateOrCancelNoFill` on the press. Rather than read
 * every candidate's book on every poll, the console remembers the ones that
 * actually failed and prefers something else.
 */
/**
 * Can this app show a price for that asset?
 *
 * The venue lists windows on assets the oracle feed does not carry — a live
 * `BOTNAV` hour window was picked up by Duel, and every screen built around the
 * price came up empty: no chart at all, a dash where the spot goes. A game whose
 * whole screen is a price chart cannot be played on a market it cannot price, so
 * such windows are not offered rather than offered broken.
 */
const isPriceable = (asset: string) => ALL_ASSETS.includes(asset);

export function shortestRound(
  windows: Window[],
  minSecsLeft = 0,
  skip?: ReadonlySet<string>,
): Window | null {
  const live = windows.filter(
    (w) => secondsLeft(w) > minSecsLeft && isPriceable(w.asset),
  );
  if (!live.length) return null;

  /*
   * The cadence is chosen BEFORE the skip list is consulted, and that ordering
   * is the point.
   *
   * `skip` holds windows a press recently found empty. Applied first, it could
   * remove the only live 1m window and hand back a 3-hour one — which is what
   * happened: a run of unlucky presses walked the console from 60s to 5m to 15m
   * to 3h, and every screen is built around a minute. A thin book is a reason to
   * prefer a different window of the SAME cadence, not a reason to change what
   * game the player is playing.
   *
   * So: shortest cadence from everything live, then avoid the skipped ones
   * within it, and fall back to them rather than return nothing.
   */
  const shortest = Math.min(...live.map((w) => w.intervalSec));
  const sameCadence = live.filter((w) => w.intervalSec === shortest);
  const fresh = skip?.size
    ? sameCadence.filter((w) => !skip.has(w.marketId))
    : sameCadence;
  const pool = fresh.length ? fresh : sameCadence;

  return pool.sort((a, b) => a.expiry - b.expiry)[0] ?? null;
}

/**
 * The window a player rolls into when this one closes.
 *
 * Same ASSET, soonest expiry after this one — deliberately not the same cadence.
 * The first version required both and found nothing against 27 open windows:
 * this venue's series are irregular (31s, 115s and 507s one-offs are on record),
 * so "the next 1m BTC window" frequently does not exist while "the next BTC
 * window" does. The looser rule is also the truthful one, because it is what the
 * games themselves pick next.
 *
 * Null when nothing follows, which the chart shows as no forward band at all.
 */
export function nextAfter(windows: Window[], current: Window): Window | null {
  return (
    windows
      .filter((w) => w.asset === current.asset && w.expiry > current.expiry)
      .sort((a, b) => a.expiry - b.expiry)[0] ?? null
  );
}

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
  // Same rule as `shortestRound`: never hand back a market this app cannot
  // draw a price for.
  return (
    pool.filter(
      (w) => secondsLeft(w) > minSecsLeft && isPriceable(w.asset),
    )[0] ?? null
  );
}
