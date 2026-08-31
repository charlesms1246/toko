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
import {
  CHAIN,
  COLLATERAL,
  GRANT_INTERVAL_MS,
  HTTP_RPC_URL,
  SIGNUP_GRANT,
  TOPUP_THRESHOLD_STT,
  WEEKLY_GRANT,
} from "./config";

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
  // Whoever's link brought them here, stored by `/r/[code]` or `/@handle`. This
  // is the one moment attribution can be recorded honestly: we are paying for
  // this player's first gas, so we know they are new.
  let ref: string | undefined;
  try {
    ref = window.localStorage.getItem("toko_ref") ?? undefined;
  } catch {
    ref = undefined;
  }
  try {
    const res = await fetch("/api/topup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, ref }),
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

/** Where the player's own claim schedule is kept. */
const GRANT_KEY = "toko_grant_last_v1";

export interface GrantResult extends FundingResult {
  /** tUSDC minted, in whole units. */
  amount?: number;
  kind?: "signup" | "weekly";
  /** When the next claim becomes available, ms since epoch. */
  nextAt?: number;
}

const lastClaim = (): number => {
  try {
    return Number(window.localStorage.getItem(GRANT_KEY) ?? 0);
  } catch {
    return 0;
  }
};

/**
 * How many players a referral code has actually brought in.
 *
 * Counted where it can be observed honestly: we pay for every new player's
 * first gas, so the sponsorship route knows which code each funded wallet
 * arrived with. Null when it cannot be read — never a zero standing in for
 * "unknown".
 */
export async function invitedCount(code: string): Promise<number | null> {
  if (!code) return null;
  try {
    const res = await fetch(`/api/topup?ref=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { invited?: number };
    return typeof body.invited === "number" ? body.invited : null;
  } catch {
    return null;
  }
}

/**
 * What the next claim would be, and when it unlocks.
 *
 * `nextAt` of 0 means there is nothing to wait for. Deliberately free of
 * `Date.now()` so a screen can call it while rendering — reading the clock
 * during render is what the React Compiler's purity rule rejects, so the caller
 * compares against its own ticking clock.
 */
export function grantStatus(): {
  amount: number;
  kind: "signup" | "weekly";
  nextAt: number;
} {
  const last = typeof window === "undefined" ? 0 : lastClaim();
  return {
    amount: last ? WEEKLY_GRANT : SIGNUP_GRANT,
    kind: last ? "weekly" : "signup",
    nextAt: last ? last + GRANT_INTERVAL_MS : 0,
  };
}

/**
 * Mint the player's collateral: `SIGNUP_GRANT` the first time, `WEEKLY_GRANT`
 * once a week after that.
 *
 * The tokens are minted by the collateral contract's own `faucet`, from the
 * player's wallet — so the balance is genuinely theirs and genuinely on chain.
 *
 * **The weekly cadence is a schedule, not a lock.** That faucet is public and
 * will mint anyone any amount, so nothing here could stop a determined person
 * on a testnet, and pretending otherwise would be the dishonest part. What the
 * schedule does is give starting out a shape: a stake worth a few hundred
 * rounds, refilled weekly, rather than an infinite pile that makes nothing
 * count. The claim time is kept locally because it is the player's own record.
 */
export async function requestCollateral(): Promise<GrantResult> {
  const address = ensureWallet();
  if (!account || !address) return { ok: false, reason: "No wallet yet" };
  if (needsGas(state.gas)) return { ok: false, reason: "Needs STT for gas first" };

  const status = grantStatus();
  if (Date.now() < status.nextAt) {
    const days = Math.ceil((status.nextAt - Date.now()) / (24 * 60 * 60 * 1000));
    return {
      ok: false,
      reason: `Next ${WEEKLY_GRANT} ${COLLATERAL.symbol} in ${days} day${days === 1 ? "" : "s"}`,
      nextAt: status.nextAt,
    };
  }

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
      args: [
        BigInt(status.amount) * 10n ** BigInt(COLLATERAL.decimals),
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    try {
      window.localStorage.setItem(GRANT_KEY, String(Date.now()));
    } catch {
      // not persisted — the schedule restarts, which only ever helps the player
    }
    await refresh();
    return {
      ok: true,
      hash,
      amount: status.amount,
      kind: status.kind,
      nextAt: Date.now() + GRANT_INTERVAL_MS,
    };
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
