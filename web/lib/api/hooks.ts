"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as store from "./store";
import {
  priceHistory,
  spot,
  subscribeTick,
  type PricePoint,
} from "./prices";
import type { GameId, MinigameId, Play } from "./types";
import { useLatest } from "@/lib/react/hooks";

/**
 * Store reads go through `useSyncExternalStore`, which requires a snapshot that
 * keeps the same reference until something actually changes. The store hands
 * out fresh objects on every call, so results are cached against its version
 * counter and only recomputed when that counter moves.
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

/** Bind a cached snapshot to the store. */
function useSnapshot<T>(get: () => T): T {
  return useSyncExternalStore(store.subscribe, get, get);
}

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
}

const getUser = () => snapshot("user", store.getUser);
const getBalance = () => snapshot("balance", store.getBalance);
const getSettings = () => snapshot("settings", store.getSettings);
const getStats = () => snapshot("stats", store.getStats);
const getAchievements = () => snapshot("achievements", store.getAchievements);
const getStakeLadder = () => snapshot("ladder", store.getStakeLadder);
const getMarkets = () => snapshot("markets", store.getMarkets);
const getReferral = () => snapshot("referral", store.getReferral);
const getAdmin = () => snapshot("admin", store.isAdmin);
const getHydrated = () => snapshot("hydrated", store.isHydrated);

export const useUser = () => useSnapshot(getUser);
export const useBalance = () => useSnapshot(getBalance);
export const useSettings = () => useSnapshot(getSettings);
export const useStats = () => useSnapshot(getStats);
export const useAchievements = () => useSnapshot(getAchievements);
export const useStakeLadder = () => useSnapshot(getStakeLadder);
export const useMarkets = () => useSnapshot(getMarkets);
export const useReferral = () => useSnapshot(getReferral);
export const useIsAdmin = () => useSnapshot(getAdmin);

/** False until the persisted demo state has been read on the client. */
export const useStoreHydrated = () => useSnapshot(getHydrated);

export function usePlays(status?: Play["status"], limit = 30) {
  const get = useMemo(
    () =>
      () =>
        snapshot(`plays:${status ?? "all"}:${limit}`, () =>
          store.listPlays({ status, limit }),
        ),
    [status, limit],
  );
  return useSnapshot(get);
}

export function useLeaderboard(game?: GameId) {
  const get = useMemo(
    () => () =>
      snapshot(`leaderboard:${game ?? "all"}`, () => store.getLeaderboard(game)),
    [game],
  );
  return useSnapshot(get);
}

export function useMinigameBoard(game: MinigameId) {
  const get = useMemo(
    () => () =>
      snapshot(`minigame:${game}`, () => store.getMinigameBoard(game)),
    [game],
  );
  return useSnapshot(get);
}

export function useMinigameBest(game: MinigameId) {
  const get = useMemo(
    () => () => snapshot(`best:${game}`, () => store.getMinigameBest(game)),
    [game],
  );
  return useSnapshot(get);
}

export function usePlay(id: string | null) {
  const get = useMemo(
    () => () =>
      id ? snapshot(`play:${id}`, () => store.getPlay(id)) : undefined,
    [id],
  );
  return useSnapshot(get);
}

export function useRangeQuotes(asset: string) {
  const version = usePriceVersion();
  return useMemo(() => {
    void version;
    return store.rangeQuotes(asset);
  }, [asset, version]);
}

export function useMoonshotAim(asset: string) {
  const version = usePriceVersion();
  return useMemo(() => {
    void version;
    return store.moonshotAim(asset);
  }, [asset, version]);
}

// ── Prices ───────────────────────────────────────────────────────────────────

/** Increments on every price tick, for memos that depend on live prices. */
let priceVersion = 0;
if (typeof window !== "undefined") {
  subscribeTick(() => {
    priceVersion += 1;
  });
}

function usePriceVersion(): number {
  return useSyncExternalStore(
    subscribeTick,
    () => priceVersion,
    () => 0,
  );
}

export function useSpot(asset: string): number {
  const get = useMemo(() => () => spot(asset), [asset]);
  return useSyncExternalStore(subscribeTick, get, get);
}

export function usePriceHistory(asset: string): PricePoint[] {
  const get = useMemo(() => () => priceHistory(asset), [asset]);
  return useSyncExternalStore(subscribeTick, get, get);
}

// ── Round helpers ────────────────────────────────────────────────────────────

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

/** Fires once per settled play, for toasts and stingers. */
export function useSettleListener(fn: (play: Play, unlocked: string[]) => void) {
  const handler = useLatest(fn);
  useEffect(
    () => store.onSettle((play, unlocked) => handler.current(play, unlocked)),
    [handler],
  );
}

/**
 * An in-flight play for this game, left over from another page or a reload.
 *
 * Range is excluded on purpose: its rounds are clock-bound and short, so there
 * is nothing to come back to.
 */
export function useRestorePlay(game: string): Play | undefined {
  // The store's ticker settles plays as they expire, so anything still listed
  // as open really is live — no need to re-check the clock here.
  const open = usePlays("open", 30);
  return useMemo(
    () => open.find((p) => p.game === game && p.game !== "range"),
    [open, game],
  );
}

/** Hydrate persisted demo state once, on the client. */
export function useHydrateStore() {
  useEffect(() => {
    store.hydrate();
  }, []);
}

export function useStoreActions() {
  return useMemo(
    () => ({
      openLucky: store.openLucky,
      openRange: store.openRange,
      openMoonshot: store.openMoonshot,
      openLabPlay: store.openLabPlay,
      cashOut: store.cashOut,
      requestFaucet: store.requestFaucet,
      requestGrant: store.requestGrant,
      deposit: store.deposit,
      withdraw: store.withdraw,
      updateSettings: store.updateSettings,
      setUsername: store.setUsername,
      setAvatar: store.setAvatar,
      setAdmin: store.setAdmin,
      submitMinigameScore: store.submitMinigameScore,
      claimReferral: store.claimReferral,
    }),
    [],
  );
}

// ── Stake ────────────────────────────────────────────────────────────────────

const STAKE_IDX_KEY = "toko_stake_idx";
const DEFAULT_STAKE_INDEX = 2;

/**
 * The selected stake rung, held outside React so it can be read with a
 * server/client snapshot split — the server always reports the default rung, so
 * hydration matches, and the persisted rung takes over on the client.
 */
let stakeIndex = DEFAULT_STAKE_INDEX;
let stakeHydrated = false;
const stakeListeners = new Set<() => void>();

function emitStake() {
  stakeListeners.forEach((fn) => fn());
}

function subscribeStake(fn: () => void) {
  stakeListeners.add(fn);
  return () => {
    stakeListeners.delete(fn);
  };
}

function hydrateStake() {
  if (stakeHydrated) return;
  stakeHydrated = true;
  try {
    const raw = window.localStorage.getItem(STAKE_IDX_KEY);
    if (raw == null) return;
    const parsed = Number(JSON.parse(raw));
    if (Number.isInteger(parsed) && parsed !== stakeIndex) {
      stakeIndex = parsed;
      emitStake();
    }
  } catch {
    // keep the default rung
  }
}

function setStakeIndex(next: number) {
  stakeIndex = next;
  try {
    window.localStorage.setItem(STAKE_IDX_KEY, JSON.stringify(next));
  } catch {
    // not persisted
  }
  emitStake();
}

/** Persisted stake index, shared with the console's thumbwheel. */
export function useStakeIndex() {
  const ladder = useStakeLadder();
  const index = useSyncExternalStore(
    subscribeStake,
    () => stakeIndex,
    () => DEFAULT_STAKE_INDEX,
  );

  useEffect(() => {
    hydrateStake();
  }, []);

  const set = useCallback((next: number) => setStakeIndex(next), []);
  const clamped = Math.max(0, Math.min(ladder.length - 1, index));
  return { ladder, index: clamped, stake: ladder[clamped] ?? 1, set };
}
