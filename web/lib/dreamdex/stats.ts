"use client";

/**
 * The player's real record, derived from their on-chain fills.
 *
 * There is no stored scoreboard. Every number here is recomputed from what the
 * wallet actually did: `getPortfolio` returns every fill, each fill names its
 * market, and each market carries its own resolution. Group the fills by market
 * and you have the rounds — what was paid, what came back, and whether it won.
 *
 * Why not use positions? A redeemed winner has a zero balance, so it vanishes
 * from the position list. Fills are the only complete record.
 */

import { getClient } from "./client";
import { COLLATERAL } from "./config";
import { ensureWallet } from "./wallet";

const ONE = 10 ** COLLATERAL.decimals;

export interface Round {
  marketAddress: string;
  asset: string;
  /** 0 = up, 1 = down. The side the player ended up on. */
  side: 0 | 1;
  /** Contracts bought, net of anything sold back. */
  contracts: number;
  /** Collateral paid in, tUSDC. */
  cost: number;
  /** Collateral received — sales plus any settlement payout. */
  proceeds: number;
  pnl: number;
  at: number;
  /** Null while the market is still trading. */
  won: boolean | null;
  voided: boolean;
  /** True when the position was sold rather than held to settlement. */
  soldEarly: boolean;
  /** Effective entry price in the side's own terms. */
  entryPrice: number;
  txHash: string;
}

export interface Stats {
  rounds: Round[];
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  volume: number;
  netPnl: number;
  bestMultiple: number;
  currentStreak: number;
  maxStreak: number;
  firstAt: number | null;
  assets: string[];
}

export const EMPTY_STATS: Stats = {
  rounds: [],
  played: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  volume: 0,
  netPnl: 0,
  bestMultiple: 0,
  currentStreak: 0,
  maxStreak: 0,
  firstAt: null,
  assets: [],
};

interface StatsState {
  stats: Stats;
  loading: boolean;
  error: string | null;
  at: number;
}

const SERVER_STATE: StatsState = {
  stats: EMPTY_STATS,
  loading: false,
  error: null,
  at: 0,
};

let state: StatsState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<StatsState>) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function build(trades: any[], resolutions: Map<string, any>): Stats {
  const byMarket = new Map<string, Round>();

  // Oldest first, so streaks and "first trade" read in the right order.
  const ordered = [...trades].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp),
  );

  for (const t of ordered) {
    const address = t.market?.marketAddress;
    if (!address) continue;
    const isUp = String(t.side).includes("YES");
    const isBuy = String(t.side).startsWith("BUY");
    const qty = Number(t.quantity) / ONE;
    // `fillPrice` is the YES price on every side; convert to the side traded.
    const yesPrice = Number(t.fillPrice) / ONE;
    const price = isUp ? yesPrice : 1 - yesPrice;
    const value = qty * price;
    const at = Number(t.timestamp) * 1000;

    const existing = byMarket.get(address);
    const round: Round =
      existing ??
      {
        marketAddress: address,
        asset: t.market?.asset ?? "—",
        side: isUp ? 0 : 1,
        contracts: 0,
        cost: 0,
        proceeds: 0,
        pnl: 0,
        at,
        won: null,
        voided: false,
        soldEarly: false,
        entryPrice: price,
        txHash: t.txHash,
      };

    if (isBuy) {
      round.contracts += qty;
      round.cost += value;
      round.side = isUp ? 0 : 1;
      round.entryPrice = round.cost / Math.max(round.contracts, 1e-9);
    } else {
      round.contracts -= qty;
      round.proceeds += value;
      round.soldEarly = true;
    }
    byMarket.set(address, round);
  }

  const rounds: Round[] = [];
  for (const round of byMarket.values()) {
    const chain = resolutions.get(round.marketAddress);
    if (chain) {
      round.voided = !!chain.voided;
      if (chain.settled) {
        if (chain.voided) {
          round.won = null;
          round.proceeds += Math.max(round.contracts, 0) * 0.5;
        } else {
          round.won = Number(chain.winningOutcome) === round.side;
          if (round.won) round.proceeds += Math.max(round.contracts, 0);
        }
      }
    }
    round.pnl = round.proceeds - round.cost;
    rounds.push(round);
  }

  rounds.sort((a, b) => b.at - a.at);

  const settled = rounds.filter((r) => r.won !== null);
  const wins = settled.filter((r) => r.won).length;
  const losses = settled.length - wins;

  // Streaks run oldest → newest.
  let currentStreak = 0;
  let maxStreak = 0;
  for (const r of [...settled].reverse()) {
    if (r.won) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    rounds,
    played: rounds.length,
    wins,
    losses,
    winRate: settled.length ? wins / settled.length : 0,
    volume: rounds.reduce((sum, r) => sum + r.cost, 0),
    netPnl: rounds.reduce((sum, r) => sum + r.pnl, 0),
    bestMultiple: rounds.reduce(
      (best, r) => (r.entryPrice > 0 ? Math.max(best, 1 / r.entryPrice) : best),
      0,
    ),
    currentStreak,
    maxStreak,
    firstAt: rounds.length ? rounds[rounds.length - 1].at : null,
    assets: [...new Set(rounds.map((r) => r.asset))],
  };
}

export async function load(): Promise<void> {
  set({ loading: true, error: null });
  try {
    const client = getClient();
    const owner = ensureWallet();
    if (!client || !owner) {
      set({ loading: false, error: "No wallet yet" });
      return;
    }

    const portfolio = await client.getPortfolio(owner);
    const trades = (portfolio?.trades ?? []) as unknown[];

    // Each distinct market's outcome, read once.
    const addresses = [
      ...new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trades.map((t: any) => t.market?.marketAddress).filter(Boolean),
      ),
    ] as string[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolutions = new Map<string, any>();
    await Promise.all(
      addresses.map(async (address) => {
        try {
          const market = await client.getBinaryMarket(address);
          if (!market) return;
          resolutions.set(address, {
            settled: ["Resolved", "Finalized"].includes(market.status),
            winningOutcome: market.winningOutcome,
            voided: market.voided,
          });
        } catch {
          // Leave it unresolved rather than guessing an outcome.
        }
      }),
    );

    set({ stats: build(trades, resolutions), loading: false, at: Date.now() });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Could not read your record",
    });
  }
}
