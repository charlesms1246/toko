/**
 * Local user state.
 *
 * This was the demo backend — an account balance, a play lifecycle and fixture
 * data for every menu screen. All of it is gone: the games trade real Event
 * Contract windows, the balance is the wallet's real tUSDC, and the player's
 * record is rebuilt from on-chain fills in `lib/dreamdex/stats.ts`.
 *
 * What remains is the only thing that was ever genuinely local — preferences,
 * a chosen name, and personal bests — persisted to `localStorage`.
 */

import type { MinigameId, Settings } from "./types";

// ── Account state ────────────────────────────────────────────────────────────

interface State {
  balance: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  settings: Settings;
  minigameScores: Record<MinigameId, number>;
  referralCode: string;
  referralClaimed: number;
  admin: boolean;
  lastFaucetMs: number;
}

const DEFAULT_SETTINGS: Settings = {
  confirmTrades: true,
  sounds: true,
  haptics: true,
  music: true,
  reduceMotion: false,
};

const STORAGE_KEY = "toko_demo_state";

function initialState(): State {
  return {
    balance: 250,
    username: "toko_demo",
    displayName: "TOKO Demo",
    avatarUrl: null,
    settings: { ...DEFAULT_SETTINGS },
    minigameScores: { "line-rider": 1240, "flappy-piper": 14 },
    referralCode: "TOKO-DEMO",
    referralClaimed: 0,
    admin: false,
    lastFaucetMs: 0,
  };
}

let state: State = initialState();


// ── Persistence ──────────────────────────────────────────────────────────────

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        balance: state.balance,
        username: state.username,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        settings: state.settings,
        minigameScores: state.minigameScores,
        referralClaimed: state.referralClaimed,
        admin: state.admin,
      }),
    );
  } catch {
    // storage unavailable — the demo just won't persist
  }
}

/** True once the persisted state has been read on the client. */
let hydrated = false;

export const isHydrated = () => hydrated;

export function hydrate() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<State>;
    state = {
      ...state,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    };
  } catch {
    // corrupt blob — keep the fresh state
  }
  emit();
}

// ── Subscription ─────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getVersion() {
  return version;
}

// ── Preferences and identity ─────────────────────────────────────────────────

export const getSettings = (): Settings => state.settings;

export function updateSettings(patch: Partial<Settings>) {
  state.settings = { ...state.settings, ...patch };
  persist();
  emit();
}

export const getUsername = () => state.username;
export const getDisplayName = () => state.displayName;
export const getAvatar = () => state.avatarUrl;

export function setUsername(name: string) {
  state.username = name.trim().slice(0, 20) || state.username;
  state.displayName = state.username;
  persist();
  emit();
}

export function setAvatar(url: string | null) {
  state.avatarUrl = url;
  persist();
  emit();
}

export const isAdmin = () => state.admin;

export function setAdmin(next: boolean) {
  state.admin = next;
  persist();
  emit();
}

// ── Minigames ────────────────────────────────────────────────────────────────

export const getMinigameBest = (game: MinigameId) => state.minigameScores[game] ?? 0;

/** Personal best only. A shared board would need a real backend. */
export function submitMinigameScore(game: MinigameId, score: number) {
  if (score <= (state.minigameScores[game] ?? 0)) return;
  state.minigameScores[game] = score;
  persist();
  emit();
}

// ── Referrals ────────────────────────────────────────────────────────────────

/**
 * The player's own share link. There is no referral backend, so there are no
 * invite counts or earnings to report — inventing them is exactly what rule 0.5
 * forbids. Attribution would need a real indexer keyed on the referral code.
 */
export function getReferral() {
  return {
    code: state.referralCode || state.username,
    handle: state.username,
    url: `https://toko.app/@${state.username}`,
  };
}

