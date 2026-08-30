"use client";

/**
 * The player's wallet.
 *
 * `Wallet` is the seam a managed wallet (Privy / Turnkey / Dynamic) drops into
 * later without touching callers. `EmbeddedWallet` is the only implementation
 * now: a key generated in the browser and kept in `localStorage`.
 *
 * That is a **burner, and testnet-only by design** — the key sits where any XSS
 * could read it, and there is no recovery if the device is lost. It holds STT
 * for gas and testnet tUSDC, nothing else. Before mainnet this file is where the
 * swap happens, and nowhere else should need to change.
 *
 * State lives outside React and is read through `useSyncExternalStore`, with a
 * server snapshot that reports "no wallet" so nothing renders differently on the
 * server than on the client.
 */

import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAIN, COLLATERAL, HTTP_RPC_URL, TOPUP_THRESHOLD_STT } from "./config";

const KEY_STORAGE = "toko_wallet_key_v1";

export interface WalletState {
  address: Address | null;
  /** Native STT, raw wei. */
  gas: bigint;
  /** Collateral, raw (6 decimals on testnet). */
  collateral: bigint;
  /** False until the key has been read from storage on the client. */
  ready: boolean;
  /** True while a balance read is in flight. */
  loading: boolean;
  /** Last read that failed, for honest display rather than a silent zero. */
  error: string | null;
}

const SERVER_STATE: WalletState = {
  address: null,
  gas: 0n,
  collateral: 0n,
  ready: false,
  loading: false,
  error: null,
};

let state: WalletState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<WalletState>) {
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

// ── The key ─────────────────────────────────────────────────────────────────

let account: ReturnType<typeof privateKeyToAccount> | null = null;

function loadKey(): `0x${string}` | null {
  try {
    const raw = window.localStorage.getItem(KEY_STORAGE);
    return raw && /^0x[0-9a-fA-F]{64}$/.test(raw) ? (raw as `0x${string}`) : null;
  } catch {
    return null;
  }
}

/**
 * Adopt the stored key, generating one on first run. Safe to call repeatedly.
 * Returns the address so callers can act on it without waiting for a render.
 */
export function ensureWallet(): Address | null {
  if (account) return account.address;
  if (typeof window === "undefined") return null;

  let key = loadKey();
  if (!key) {
    key = generatePrivateKey();
    try {
      window.localStorage.setItem(KEY_STORAGE, key);
    } catch {
      // Not persisted — the wallet works for this session and is gone after it.
    }
  }
  account = privateKeyToAccount(key);
  set({ address: account.address, ready: true });
  return account.address;
}

/** The signing account, for the phases that place orders. Null before hydration. */
export const getAccount = () => account;

/**
 * Export the raw key so a player can move funds out or import elsewhere. This
 * is the only recovery path a burner has, so it must exist.
 */
export function exportKey(): `0x${string}` | null {
  return typeof window === "undefined" ? null : loadKey();
}

// ── Balances ────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function faucet(uint256 amount)",
]);

export async function refresh(): Promise<void> {
  const address = ensureWallet();
  if (!address) return;
  set({ loading: true, error: null });
  try {
    const [gas, collateral] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.readContract({
        address: COLLATERAL.address,
        abi: erc20,
        functionName: "balanceOf",
        args: [address],
      }) as Promise<bigint>,
    ]);
    set({ gas, collateral, loading: false });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Could not read balances",
    });
  }
}

export const formatGas = (wei: bigint) => Number(formatEther(wei)).toFixed(4);
export const formatCollateral = (raw: bigint) =>
  Number(formatUnits(raw, COLLATERAL.decimals)).toFixed(2);

/** True when the wallet cannot pay for a transaction. */
export function needsGas(gas: bigint): boolean {
  return gas < BigInt(Math.round(Number(TOPUP_THRESHOLD_STT) * 1e18));
}

// ── Funding ─────────────────────────────────────────────────────────────────

export interface FundingResult {
  ok: boolean;
  hash?: Hash;
  /** Set when the request was declined for a reason worth showing. */
  reason?: string;
}

/**
 * Ask our treasury to cover gas. The treasury key is server-side only — a
 * browser holding it could be drained by anyone who opened devtools — so this
 * is a request to our own route, not a transaction we sign.
 */
export async function requestGas(): Promise<FundingResult> {
  const address = ensureWallet();
  if (!address) return { ok: false, reason: "No wallet yet" };
  try {
    const res = await fetch("/api/topup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = (await res.json()) as { hash?: Hash; error?: string; skipped?: boolean };
    if (!res.ok) return { ok: false, reason: body.error ?? `Top-up failed (${res.status})` };
    if (body.skipped) return { ok: false, reason: "Already funded" };
    await refresh();
    return { ok: true, hash: body.hash };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Top-up failed" };
  }
}

/** 10,000 tUSDC from the collateral contract's own faucet. Needs gas first. */
export const COLLATERAL_FAUCET_AMOUNT = 10_000n * 10n ** BigInt(COLLATERAL.decimals);

export async function requestCollateral(): Promise<FundingResult> {
  const address = ensureWallet();
  if (!account || !address) return { ok: false, reason: "No wallet yet" };
  if (needsGas(state.gas)) return { ok: false, reason: "Needs STT for gas first" };

  try {
    const { createWalletClient } = await import("viem");
    const wallet = createWalletClient({
      account,
      chain: CHAIN,
      transport: http(HTTP_RPC_URL),
    });
    const hash = await wallet.writeContract({
      address: COLLATERAL.address,
      abi: erc20,
      functionName: "faucet",
      args: [COLLATERAL_FAUCET_AMOUNT],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await refresh();
    return { ok: true, hash };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message.split("\n")[0] : "Faucet call failed",
    };
  }
}

/** Where first-run funding has got to. Every stage is a real transaction. */
export type FundingStage = "gas" | "collateral" | "done";

/**
 * Fund a brand-new wallet so a first-time visitor can actually trade.
 *
 * Two real transactions on Shannon: our treasury sends STT for gas, then the
 * collateral contract's own faucet sends tUSDC. Each leg is skipped when the
 * wallet already has what it needs, so this is safe to call more than once —
 * and the top-up route independently refuses an address that can already pay.
 *
 * It reports failure instead of retrying. A dry or unconfigured treasury means
 * the player has to use a public faucet, and the screen calling this has to say
 * so rather than leave them on a console that silently cannot trade.
 */
export async function ensureFunded(
  onStage?: (stage: FundingStage) => void,
): Promise<FundingResult> {
  if (!ensureWallet()) return { ok: false, reason: "No wallet yet" };
  await refresh();

  if (needsGas(state.gas)) {
    onStage?.("gas");
    const gas = await requestGas();
    if (!gas.ok) {
      // "Already funded" is the route declining because we can pay — re-read
      // the balance before treating any refusal as a failure.
      await refresh();
      if (needsGas(state.gas)) return { ok: false, reason: gas.reason };
    }
  }

  if (state.collateral === 0n) {
    onStage?.("collateral");
    const collateral = await requestCollateral();
    if (!collateral.ok) return collateral;
  }

  onStage?.("done");
  return { ok: true };
}
