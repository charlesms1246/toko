"use client";

import { useEffect } from "react";
import { ConsoleThemeProvider } from "@/lib/console/theme-context";
import { ConsoleControlsProvider } from "@/lib/console/controls";
import { ToastProvider } from "@/components/ui/Toast";
import { useHydrateStore } from "@/lib/api/hooks";
import { music } from "@/lib/sound";

function Hydrate() {
  useHydrateStore();
  useEffect(() => {
    music.hydrate();
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
