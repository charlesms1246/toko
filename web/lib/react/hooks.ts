"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A ref that always holds the most recent value, updated after render.
 *
 * Used to hand fresh callbacks to imperative code (three.js listeners, rAF
 * loops) without tearing those systems down on every render. Writing the ref
 * during render would be a side effect, so the assignment happens in an effect.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const noopSubscribe = () => () => {};

/**
 * False during server render and the hydrating pass, true afterwards.
 *
 * Uses the store's server/client snapshot split rather than a state flag, so
 * there is no setState-in-effect and no extra render pass.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
