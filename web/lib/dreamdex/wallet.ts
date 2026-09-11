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
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  parseAbi,
  type Address,
  type Hash,
  type WalletClient,
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
  /*
   * A managed wallet already IS the wallet — do not go looking for a key.
   *
   * Every funding path starts by calling this, and without this line the first
   * one after a Privy login would have generated a burner and published ITS
   * address over the managed one: the grant would land on a wallet the trader
   * never signs with, and the player's balance would read as somebody else's.
   */
  if (managed) return managed.address;
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
 *
 * **Null under a managed wallet, and that is the point of one.** Privy keeps the
 * key in its own custody and hands out a provider, never the secret. Anything
 * that needs to *sign* must go through `signer()` instead; only the reveal on
 * `/menu/wallet` may ask for the key itself, and it has to handle null.
 */
export function exportKey(): `0x${string}` | null {
  if (managed) return null;
  return typeof window === "undefined" ? null : loadKey();
}

// ── Who signs ───────────────────────────────────────────────────────────────

/**
 * A managed wallet, when one is connected.
 *
 * This is the seam `wallet.ts` has documented since Phase 1 finally being used.
 * `EmbeddedWallet` is a key in `localStorage`; a managed wallet (Privy) is an
 * address plus a `WalletClient` over its provider, and the key never leaves the
 * provider. Everything above this file asks for `signer()` and does not care
 * which it got.
 */
let managed: { address: Address; client: WalletClient } | null = null;

/** Hand the app a managed wallet. Called by the Privy bridge once it is ready. */
export function attachManaged(address: Address, client: WalletClient) {
  if (managed?.address === address) return;
  managed = { address, client };
  account = null;
  set({ address, ready: true });
  void refresh();
}

/** Drop the managed wallet — a logout. Leaves no address behind. */
export function detachManaged() {
  if (!managed) return;
  managed = null;
  set({ address: null, ready: true, gas: 0n, collateral: 0n });
}

/** True when the connected wallet is managed rather than a local burner. */
export const isManaged = () => managed !== null;

/**
 * The thing that signs, whichever kind of wallet is connected.
 *
 * Three places write to the chain outside the SDK's trader — `preApprove`, the
 * withdraw form, and the trader's own construction — and all of them used to
 * build a client from the raw key. They go through here now, so a managed wallet
 * needs no change in any of them.
 */
export function signer(): WalletClient | null {
  if (managed) return managed.client;
  ensureWallet();
  if (!account) return null;
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(HTTP_RPC_URL),
  });
}

// ── Balances ────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function faucet(uint256 amount)",
]);

/** Counts refreshes so a slow reply cannot overwrite a newer balance. */
let latestRead = 0;

export async function refresh(): Promise<void> {
  const address = ensureWallet();
  if (!address) return;
  // Called from mount effects, after every order, and from `ensureFunded`, so
  // reads overlap. Only the newest may write: a reply that arrives late carries
  // a pre-trade balance, and screens read this straight after awaiting a trade.
  const mine = ++latestRead;
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
    if (mine !== latestRead) return;
    set({ gas, collateral, loading: false });
  } catch (err) {
    if (mine !== latestRead) return;
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

export interface GrantStatus {
  amount: number;
  kind: "signup" | "weekly";
  nextAt: number;
}

const readGrant = (): GrantStatus => {
  const last = lastClaim();
  return {
    amount: last ? WEEKLY_GRANT : SIGNUP_GRANT,
    kind: last ? "weekly" : "signup",
    nextAt: last ? last + GRANT_INTERVAL_MS : 0,
  };
};

let grant: GrantStatus | null = null;

function setGrant(next: GrantStatus) {
  grant = next;
  listeners.forEach((fn) => fn());
}

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
 * The schedule lives in local storage, so it is read once here and published to
 * subscribers rather than read during render — the same impurity the rest of the
 * app routes around with `useSyncExternalStore`. `nextAt` of 0 means there is
 * nothing to wait for; it is deliberately free of `Date.now()`, so a screen
 * compares it against its own ticking clock.
 */
export function hydrateGrant() {
  if (grant || typeof window === "undefined") return;
  setGrant(readGrant());
}

/** Null until `hydrateGrant` has read the schedule on the client. */
export const getGrantSnapshot = () => grant;
export const getGrantServerSnapshot = (): GrantStatus | null => null;

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
  const wallet = signer();
  if (!wallet || !address) return { ok: false, reason: "No wallet yet" };
  if (needsGas(state.gas)) return { ok: false, reason: "Needs STT for gas first" };

  const status = grant ?? readGrant();
  if (Date.now() < status.nextAt) {
    const days = Math.ceil((status.nextAt - Date.now()) / (24 * 60 * 60 * 1000));
    return {
      ok: false,
      reason: `Next ${WEEKLY_GRANT} ${COLLATERAL.symbol} in ${days} day${days === 1 ? "" : "s"}`,
      nextAt: status.nextAt,
    };
  }

  try {
    const hash = await wallet.writeContract({
      account: address,
      chain: CHAIN,
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
    setGrant(readGrant());
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
/**
 * `signin` is not funding, but it is the first thing the funding screen waits
 * on when a managed wallet is configured, and the screen needs a caption for it.
 */
export type FundingStage = "signin" | "gas" | "collateral" | "done";

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
