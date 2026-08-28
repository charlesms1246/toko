"use client";

/**
 * The console theme, held outside React.
 *
 * Keeping it in a module store lets components read it with
 * `useSyncExternalStore`: the server snapshot is always the default preset, so
 * hydration matches, and the persisted value takes over on the client without
 * an extra state-setting effect.
 */

import {
  ConsoleCustom,
  DEFAULT_PRESET,
  readStoredCustom,
  writeStoredCustom,
} from "./themes";

const SERVER_STATE: ConsoleCustom = { preset: DEFAULT_PRESET };

let state: ConsoleCustom = SERVER_STATE;
const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): ConsoleCustom {
  return state;
}

export function getServerSnapshot(): ConsoleCustom {
  return SERVER_STATE;
}

export function setCustom(next: ConsoleCustom) {
  state = next;
  writeStoredCustom(next);
  listeners.forEach((fn) => fn());
}

/** Adopt the persisted theme. Safe to call more than once. */
export function hydrate() {
  const stored = readStoredCustom();
  if (
    stored.preset === state.preset &&
    JSON.stringify(stored.parts ?? {}) === JSON.stringify(state.parts ?? {})
  ) {
    return;
  }
  state = stored;
  listeners.forEach((fn) => fn());
}
