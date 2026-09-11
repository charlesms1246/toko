"use client";

/**
 * `ConsoleControls` — the contract every game programs the hardware through.
 *
 * A route mounts a partial control set with `useProgramConsole(...)` and the 3D
 * console reflects it: key captions and colors, what the knob scrolls, what the
 * thumbwheel sizes, and the dials.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ButtonKey } from "./geometry";
import { useLatest } from "@/lib/react/hooks";

export interface TokenDisplay {
  mode: "token";
  ticker: string;
  logoSrc?: string;
}

export interface KeyControl {
  label: string;
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  display?: TokenDisplay;
  pulse?: boolean;
  onPress?: () => void;
}

export interface DialControl {
  min: number;
  max: number;
  step: number;
  value: number;
  label?: string;
  format?: (value: number) => string;
  onChange?: (value: number) => void;
}

export interface ConsoleControlsState {
  main: KeyControl | null;
  action1: KeyControl | null;
  action2: KeyControl | null;
  knob: DialControl | null;
  numberWheel: DialControl | null;
  lightShow: boolean;
}

export const DEFAULT_CONTROLS: ConsoleControlsState = {
  main: null,
  action1: null,
  action2: null,
  knob: null,
  numberWheel: null,
  lightShow: false,
};

interface ConsoleControlsContextValue {
  controls: ConsoleControlsState;
  setControls: (next: Partial<ConsoleControlsState> | null) => void;
  /** Fired by the 3D console (and the keyboard) when a key goes down. */
  press: (key: ButtonKey) => void;
  registerPressHandler: (fn: (key: ButtonKey) => void) => () => void;
}

const ConsoleControlsContext =
  createContext<ConsoleControlsContextValue | null>(null);

export function ConsoleControlsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [controls, setControlsState] =
    useState<ConsoleControlsState>(DEFAULT_CONTROLS);
  const handlers = useRef(new Set<(key: ButtonKey) => void>());

  // These must keep a stable identity: `useProgramConsole` lists `setControls`
  // in its dependencies, and a fresh function on every controls change would
  // re-publish forever.
  const setControls = useCallback(
    (next: Partial<ConsoleControlsState> | null) =>
      setControlsState(
        next ? { ...DEFAULT_CONTROLS, ...next } : DEFAULT_CONTROLS,
      ),
    [],
  );

  const press = useCallback(
    (key: ButtonKey) => handlers.current.forEach((fn) => fn(key)),
    [],
  );

  const registerPressHandler = useCallback((fn: (key: ButtonKey) => void) => {
    handlers.current.add(fn);
    return () => {
      handlers.current.delete(fn);
    };
  }, []);

  const value = useMemo<ConsoleControlsContextValue>(
    () => ({ controls, setControls, press, registerPressHandler }),
    [controls, setControls, press, registerPressHandler],
  );

  return (
    <ConsoleControlsContext.Provider value={value}>
      {children}
    </ConsoleControlsContext.Provider>
  );
}

export function useConsoleControls(): ConsoleControlsContextValue {
  const ctx = useContext(ConsoleControlsContext);
  if (!ctx) {
    throw new Error(
      "useConsoleControls must be used inside <ConsoleControlsProvider>",
    );
  }
  return ctx;
}

/**
 * Program the console for as long as the calling component is mounted, then
 * hand the hardware back to its default view.
 *
 * The control object is re-published on every render, so inline closures stay
 * fresh without the caller having to memoize them.
 */
export function useProgramConsole(next: Partial<ConsoleControlsState>) {
  const { setControls } = useConsoleControls();
  const serialized = JSON.stringify(next, (key, value) =>
    typeof value === "function" ? "fn" : value,
  );
  const latest = useLatest(next);

  useEffect(() => {
    // Re-publish only when something visible changed, but route the callbacks
    // through the ref so a published handler always runs this render's closure.
    const current = latest.current;

    const key = (name: "main" | "action1" | "action2"): KeyControl | null => {
      const control = current[name];
      if (!control) return null;
      return { ...control, onPress: () => latest.current[name]?.onPress?.() };
    };

    const dial = (name: "knob" | "numberWheel"): DialControl | null => {
      const control = current[name];
      if (!control) return null;
      return {
        ...control,
        onChange: (value: number) => latest.current[name]?.onChange?.(value),
      };
    };

    setControls({
      main: key("main"),
      action1: key("action1"),
      action2: key("action2"),
      knob: dial("knob"),
      numberWheel: dial("numberWheel"),
      lightShow: current.lightShow ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, setControls]);

  useEffect(() => () => setControls(null), [setControls]);
}
