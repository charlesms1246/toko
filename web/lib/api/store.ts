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
  username: string;
  displayName: string;
  avatarUrl: string | null;
  settings: Settings;
  minigameScores: Record<MinigameId, number>;
  admin: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  confirmTrades: true,
  sounds: true,
  haptics: true,
  music: true,
  reduceMotion: false,
};

/**
 * Preferences. Named `toko_demo_state` until Demo Mode became a real feature
 * with its own `toko_demo_*` keys, at which point the name meant the opposite of
 * what it holds. The old key is read once so nobody loses their settings.
 */
const STORAGE_KEY = "toko_prefs_v1";
const LEGACY_KEY = "toko_demo_state";

/**
 * A new player has no name and no high scores.
 *
 * This used to open with a `toko_demo` identity, a 250 chip balance and
 * `line-rider: 1240` — a personal best nobody had set. Seeded state on a screen
 * labelled "your best" is a small lie that survives a long time, so the defaults
 * are now genuinely empty and callers fall back to the wallet address.
 */
function initialState(): State {
  return {
    username: "",
    displayName: "",
    avatarUrl: null,
    settings: { ...DEFAULT_SETTINGS },
    minigameScores: { "line-rider": 0, "flappy-piper": 0 },
    admin: false,
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
        username: state.username,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        settings: state.settings,
        minigameScores: state.minigameScores,
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
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_KEY);
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
 *
 * The URL is built from wherever the app is actually served. It used to be
 * hardcoded to `toko.app`, a domain that does not exist — so the one thing on
 * the screen the player was meant to send someone was a dead link.
 */
export function getReferral(handle: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return { handle, url: handle ? `${origin}/@${handle}` : origin };
}

