"use client";

import { useEffect } from "react";
import { ConsoleThemeProvider } from "@/lib/console/theme-context";
import { ConsoleControlsProvider } from "@/lib/console/controls";
import { ToastProvider } from "@/components/ui/Toast";
import { useHydrateStore } from "@/lib/api/hooks";
import { music } from "@/lib/sound";
import { start as startPriceFeed } from "@/lib/api/prices";

function Hydrate() {
  useHydrateStore();
  useEffect(() => {
    music.hydrate();
    // Open the oracle feed before any screen that shows a price is reached.
    startPriceFeed();
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleThemeProvider>
      <ConsoleControlsProvider>
        <ToastProvider>
          <Hydrate />
          {children}
        </ToastProvider>
      </ConsoleControlsProvider>
    </ConsoleThemeProvider>
  );
}
