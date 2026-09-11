"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as store from "./store";
import { priceHistory, spot, subscribeTick, type PricePoint } from "./prices";
import * as wallet from "@/lib/dreamdex/wallet";
import * as execution from "@/lib/dreamdex/execution";
import type { MinigameId } from "./types";

/**
 * Store reads go through `useSyncExternalStore`, which needs a snapshot that
 * keeps the same reference until something actually changes. The store hands
 * out fresh objects, so results are cached against its version counter.
 */
const snapshots = new Map<string, { version: number; value: unknown }>();

function snapshot<T>(key: string, compute: () => T): T {
  const version = store.getVersion();
  const cached = snapshots.get(key);
  if (cached && cached.version === version) return cached.value as T;
  const value = compute();
  snapshots.set(key, { version, value });
  return value;
}

function useSnapshot<T>(get: () => T): T {
  return useSyncExternalStore(store.subscribe, get, get);
}

export const useSettings = () => useSnapshot(() => snapshot("settings", store.getSettings));
/** The player's share link, built from wherever the app is actually served. */
export function useReferral() {
  const { username, address } = useUser();
  const handle = username || shortAddress(address);
  return store.getReferral(handle);
}
export const useIsAdmin = () => useSnapshot(() => snapshot("admin", store.isAdmin));

/** False until persisted preferences have been read on the client. */
export const useStoreHydrated = () =>
  useSnapshot(() => snapshot("hydrated", store.isHydrated));

/**
 * A name for someone who has not chosen one.
 *
 * Their own address, shortened — real data rather than an invented handle. Demo
 * players never pass through the naming step, so this is the normal case for
 * them, not an edge one.
 */
export const shortAddress = (address: string) =>
  address ? `${address.slice(2, 6)}${address.slice(-4)}`.toLowerCase() : "";

/**
 * The player: their chosen name plus their real on-chain address. There is no
 * account beyond the wallet.
 *
 * `username` is what they typed; `handle` is what to show, which falls back to
 * their address when they have not named themselves.
 */
export function useUser() {
  const local = useSnapshot(() =>
    snapshot("user", () => ({
      username: store.getUsername(),
      displayName: store.getDisplayName(),
      avatarUrl: store.getAvatar(),
    })),
  );
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const address = walletState.address ?? "";
  return {
    ...local,
    address,
    handle: local.username || shortAddress(address),
  };
}

/** The real tUSDC balance, raw. Format with `wallet.formatCollateral`. */
/**
 * Spendable balance — the wallet's real collateral, or the paper one in Demo
 * Mode. Read through `execution` so the two can never disagree with what the
 * games are actually spending.
 */
export function useBalance(): bigint {
  return useSyncExternalStore(
    execution.subscribeBalance,
    execution.getBalance,
    execution.getServerBalance,
  );
}

/** False until a real balance has arrived — see `getBalanceRead`. */
export function useBalanceRead(): boolean {
  return useSyncExternalStore(
    execution.subscribeBalance,
    execution.getBalanceRead,
    execution.getServerBalanceRead,
  );
}

export function useMinigameBest(game: MinigameId) {
  const get = useMemo(
    () => () => snapshot(`best:${game}`, () => store.getMinigameBest(game)),
    [game],
  );
  return useSnapshot(get);
}

// ── Prices ───────────────────────────────────────────────────────────────────

export function useSpot(asset: string): number {
  const get = useMemo(() => () => spot(asset), [asset]);
  return useSyncExternalStore(subscribeTick, get, get);
}

export function usePriceHistory(asset: string): PricePoint[] {
  const get = useMemo(() => () => priceHistory(asset), [asset]);
  return useSyncExternalStore(subscribeTick, get, get);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A 250ms countdown to an absolute timestamp. */
export function useCountdown(expiryMs: number | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiryMs) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [expiryMs]);

  if (!expiryMs) return { remainingMs: 0, secsLeft: 0, expired: true };
  const remainingMs = Math.max(0, expiryMs - now);
  return {
    remainingMs,
    secsLeft: Math.ceil(remainingMs / 1000),
    expired: remainingMs <= 0,
  };
}

/** Hydrate persisted preferences once, on the client. */
export function useHydrateStore() {
  useEffect(() => {
    store.hydrate();
  }, []);
}

export function useStoreActions() {
  return useMemo(
    () => ({
      updateSettings: store.updateSettings,
      setUsername: store.setUsername,
      setAvatar: store.setAvatar,
      setAdmin: store.setAdmin,
      submitMinigameScore: store.submitMinigameScore,
    }),
    [],
  );
}
