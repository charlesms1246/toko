"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { ConsoleCustom, Theme, resolveTheme } from "./themes";
import * as themeStore from "./theme-store";

interface ThemeContextValue {
  custom: ConsoleCustom;
  resolved: Theme;
  set: (custom: ConsoleCustom) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ConsoleThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const custom = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  // Read localStorage once we are past hydration.
  useEffect(() => {
    themeStore.hydrate();
  }, []);

  const value = useMemo(
    () => ({
      custom,
      resolved: resolveTheme(custom),
      set: themeStore.setCustom,
    }),
    [custom],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useConsoleTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useConsoleTheme must be used inside <ConsoleThemeProvider>");
  }
  return ctx;
}
