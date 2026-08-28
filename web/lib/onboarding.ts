"use client";

/**
 * Which onboarding gates the player has already cleared.
 *
 * Held outside React so the flags can be read with `useSyncExternalStore`. The
 * server snapshot reports everything as done, so no gate is server-rendered and
 * nothing flashes for returning players; the real values take over on the
 * client after hydration.
 */

const ONBOARDED_KEY = "toko_onboarded_v1";
const TOUR_KEY = "toko.tour.seen.v1";

export interface OnboardingState {
  onboarded: boolean;
  tourSeen: boolean;
}

const SERVER_STATE: OnboardingState = { onboarded: true, tourSeen: true };

let state: OnboardingState = SERVER_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function read(): OnboardingState {
  try {
    return {
      onboarded: window.localStorage.getItem(ONBOARDED_KEY) === "1",
      tourSeen: window.localStorage.getItem(TOUR_KEY) === "1",
    };
  } catch {
    return { onboarded: false, tourSeen: false };
  }
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

/** Adopt the persisted flags. Safe to call more than once. */
export function hydrate() {
  if (hydrated) return;
  hydrated = true;
  state = read();
  emit();
}

function write(key: string, value: OnboardingState) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // not persisted — the gate will show again next session
  }
  state = value;
  emit();
}

export function completeOnboarding() {
  write(ONBOARDED_KEY, { ...state, onboarded: true });
}

export function completeTour() {
  write(TOUR_KEY, { ...state, tourSeen: true });
}
