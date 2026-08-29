"use client";

/**
 * What the player holds.
 *
 * Outcome tokens are ids on one shared ERC-6909 singleton, not per-market
 * ERC-20s, so a position is a balance of `(outcomeToken, tokenId)`. The id
 * encodes `(pool << 72) | (nonce << 8) | idx` — which is why a pool address
 * alone never identifies a market, and why everything here is keyed by the
 * window's own token ids.
 */

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { CHAIN, COLLATERAL, HTTP_RPC_URL } from "./config";
import { OUTCOME_TOKEN } from "./orders";
import { ensureWallet } from "./wallet";
import type { Window } from "./markets";

const ONE = 10 ** COLLATERAL.decimals;

const erc6909 = parseAbi([
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
]);

const publicClient = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });

export interface Holding {
  /** Contracts held on each side, raw. */
  up: bigint;
  down: bigint;
}

export const EMPTY_HOLDING: Holding = { up: 0n, down: 0n };

export async function readHolding(window: Window): Promise<Holding> {
  const owner = ensureWallet();
  if (!owner) return EMPTY_HOLDING;

  const [up, down] = await Promise.all([
    publicClient.readContract({
      address: OUTCOME_TOKEN,
      abi: erc6909,
      functionName: "balanceOf",
      args: [owner as Address, BigInt(window.yesTokenId)],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: OUTCOME_TOKEN,
      abi: erc6909,
      functionName: "balanceOf",
      args: [owner as Address, BigInt(window.noTokenId)],
    }) as Promise<bigint>,
  ]);

  return { up, down };
}

export const contracts = (raw: bigint) => Number(raw) / ONE;

// ── Watching the position on screen ─────────────────────────────────────────

export interface HoldingState {
  marketId: string | null;
  holding: Holding;
  error: string | null;
}

const SERVER_STATE: HoldingState = {
  marketId: null,
  holding: EMPTY_HOLDING,
  error: null,
};

let state: HoldingState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<HoldingState>) {
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

let poll: ReturnType<typeof setInterval> | null = null;

/** Follow one window's holding. Refreshes immediately after a trade. */
export function track(window: Window, everyMs = 4000): () => void {
  if (state.marketId !== window.marketId) {
    set({ marketId: window.marketId, holding: EMPTY_HOLDING, error: null });
  }

  const tick = async () => {
    try {
      const holding = await readHolding(window);
      // A late response for a window we have moved off must not overwrite.
      if (state.marketId === window.marketId) set({ holding, error: null });
    } catch (err) {
      if (state.marketId === window.marketId) {
        set({ error: err instanceof Error ? err.message : "Could not read position" });
      }
    }
  };

  // Always replace: `??=` would keep an interval closed over the previous window.
  if (poll) clearInterval(poll);
  void tick();
  poll = setInterval(() => void tick(), everyMs);

  refreshNow = tick;
  return () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
    refreshNow = null;
  };
}

let refreshNow: (() => Promise<void>) | null = null;

/** Re-read the tracked holding straight away, after a fill. */
export const refresh = () => refreshNow?.();
