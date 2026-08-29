"use client";

/**
 * On-chain history for the player's wallet.
 *
 * Read back from the explorer rather than from anything the app remembers
 * doing, so it stays right across devices and includes transfers that arrived
 * from outside the app.
 *
 * Lives outside React for the same reason the wallet does: the React Compiler
 * rules in Next 16 reject setting state from inside an effect, and an async
 * fetch on mount is exactly that shape. Pushing it into a module store and
 * reading through `useSyncExternalStore` sidesteps it and matches
 * `lib/dreamdex/wallet.ts`.
 */

import type { ActivityRow } from "@/app/api/activity/route";

export type { ActivityRow };

export interface ActivityState {
  rows: ActivityRow[] | null;
  loading: boolean;
  error: string | null;
}

const SERVER_STATE: ActivityState = { rows: null, loading: false, error: null };

let state: ActivityState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<ActivityState>) {
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

export async function load(address: string): Promise<void> {
  set({ loading: true, error: null });
  try {
    const res = await fetch(`/api/activity?address=${address}`);
    const body = (await res.json()) as { rows?: ActivityRow[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
    set({ rows: body.rows ?? [], loading: false });
  } catch (err) {
    set({
      rows: state.rows ?? [],
      loading: false,
      error: err instanceof Error ? err.message : "Could not load history",
    });
  }
}
