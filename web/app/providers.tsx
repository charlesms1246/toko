"use client";

import { useEffect } from "react";
import { ConsoleThemeProvider } from "@/lib/console/theme-context";
import { ConsoleControlsProvider } from "@/lib/console/controls";
import { ToastProvider } from "@/components/ui/Toast";
import { useHydrateStore } from "@/lib/api/hooks";
import { music } from "@/lib/sound";
import { start as startPriceFeed } from "@/lib/api/prices";
import { PrivyProvider } from "@privy-io/react-auth";
import PrivyBridge from "@/components/wallet/PrivyBridge";
import { CHAIN, PRIVY_APP_ID } from "@/lib/dreamdex/config";

/**
 * Privy, when an app id is configured.
 *
 * Wrapped rather than always-on because an empty id is a real deployment state —
 * without it the app keeps the embedded burner and nothing else changes. The
 * provider is the only thing gated; `PrivyBridge` lives inside it and is what
 * actually reaches the wallet store.
 *
 * `createOnLogin: "users-without-wallets"` is what makes signing in *be* getting
 * a wallet: the player never sees a second step, which is the same one-tap
 * onboarding the burner gave them.
 */
function WithPrivy({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        supportedChains: [CHAIN],
        defaultChain: CHAIN,
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        /*
         * Privy defaults to a LIGHT modal, which on this app arrives as a white
         * card over a black console — the one bright rectangle in the product,
         * at the moment a player is deciding to trust it.
         *
         * `accentColor` is `--color-brand-500` from `globals.css`, so the
         * modal's buttons are the same amber as the console's own.
         */
        appearance: {
          theme: "dark",
          accentColor: "#ffc016",
          landingHeader: "Sign in to play",
        },
      }}
    >
      <PrivyBridge />
      {children}
    </PrivyProvider>
  );
}

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
    <WithPrivy>
      <ConsoleThemeProvider>
        <ConsoleControlsProvider>
          <ToastProvider>
            <Hydrate />
            {children}
          </ToastProvider>
        </ConsoleControlsProvider>
      </ConsoleThemeProvider>
    </WithPrivy>
  );
}
