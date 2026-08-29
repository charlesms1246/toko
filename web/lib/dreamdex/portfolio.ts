"use client";

/**
 * Everything the player holds, across every market.
 *
 * `getPortfolio` is account-scoped and returns positions, open orders and trades
 * in one read — which is why it, and not the pool-scoped `getFills`, backs this.
 *
 * A position is classified from its market, not from anything the app
 * remembers:
 *
 * - **live** — the market is still trading, so the position is worth whatever
 *   the book will pay for it.
 * - **winner** — resolved, not voided, and this is the winning side: redeems for
 *   exactly 1 collateral unit per contract.
 * - **voided** — no reliable settlement price, so *both* sides redeem at 0.5 and
 *   both must be claimed explicitly.
 * - **loser** — resolved the other way. Redeeming succeeds and pays zero, so
 *   there is no reason to spend gas on it.
 */

import { getClient } from "./client";
import { ensureWallet } from "./wallet";
import { COLLATERAL } from "./config";

const ONE = 10 ** COLLATERAL.decimals;

export type PositionKind = "live" | "winner" | "voided" | "loser";

export interface Position {
  marketId: string;
  poolAddress: string;
  asset: string;
  interval: string;
  /** 0 = up (YES), 1 = down (NO). */
  outcomeIndex: 0 | 1;
  /** Contracts held, raw. */
  balance: bigint;
  expiry: number;
  status: string;
  kind: PositionKind;
  /** Collateral this redeems for, raw. Zero for live and losing positions. */
  redeemable: bigint;
}

export interface PortfolioState {
  positions: Position[];
  loading: boolean;
  error: string | null;
  at: number;
}

const SERVER_STATE: PortfolioState = {
  positions: [],
  loading: false,
  error: null,
  at: 0,
};

let state: PortfolioState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<PortfolioState>) {
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

const SETTLED = ["Resolved", "Finalized"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function classify(row: any): Position {
  const m = row.market;
  const balance = BigInt(row.balance ?? 0);
  const outcomeIndex = Number(row.outcomeIndex) === 1 ? 1 : 0;
  const settled = SETTLED.includes(m.status);

  let kind: PositionKind = "live";
  let redeemable = 0n;

  if (settled) {
    if (m.voided) {
      kind = "voided";
      // Both sides pay half on a void.
      redeemable = balance / 2n;
    } else if (Number(m.winningOutcome) === outcomeIndex) {
      kind = "winner";
      redeemable = balance;
    } else {
      kind = "loser";
    }
  }

  return {
    marketId: m.id,
    poolAddress: m.poolAddress,
    asset: m.asset,
    interval: m.interval ?? `${m.intervalSec}s`,
    outcomeIndex,
    balance,
    expiry: Number(m.expiry),
    status: m.status,
    kind,
    redeemable,
  };
}

export async function load(): Promise<void> {
  set({ loading: true, error: null });
  try {
    // Inside the try: constructing the exchange can throw, and a rejection here
    // would otherwise leave the screen loading forever with nothing to show.
    const client = getClient();
    const owner = ensureWallet();
    if (!client || !owner) {
      set({ loading: false, error: "No wallet yet" });
      return;
    }
    const portfolio = await client.getPortfolio(owner);
    const positions = ((portfolio?.positions ?? []) as unknown[])
      .map(classify)
      .filter((p) => p.balance > 0n)
      .sort((a, b) => b.expiry - a.expiry);
    set({ positions, loading: false, at: Date.now() });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Could not read positions",
    });
  }
}

let poll: ReturnType<typeof setInterval> | null = null;

export function startPolling(everyMs = 8000): () => void {
  void load();
  if (poll) clearInterval(poll);
  poll = setInterval(() => void load(), everyMs);
  return () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  };
}

export const contracts = (raw: bigint) => Number(raw) / ONE;

/** Positions worth spending gas to claim. */
export const claimable = (positions: Position[]) =>
  positions.filter((p) => p.redeemable > 0n);
