"use client";

/**
 * The sign-in seam, so onboarding never imports Privy.
 *
 * `usePrivy()` throws when there is no `PrivyProvider` above it, and an empty
 * `PRIVY_APP_ID` is a supported deployment — so a Privy hook inside the
 * onboarding gates would crash the very configuration that is meant to fall back
 * to the burner. Hooks cannot be called conditionally, so the dependency is
 * inverted instead: `PrivyBridge` (which only mounts inside the provider)
 * registers its `login` here, and onboarding calls a plain function.
 *
 * With no app id `enabled()` is false and `login()` resolves immediately, which
 * is what keeps the burner path byte-for-byte what it was.
 */

import { PRIVY_APP_ID } from "./config";
import * as wallet from "./wallet";

let open: (() => void) | null = null;
let abandon: (() => void) | null = null;

/** Called by the bridge. */
export function register(fn: (() => void) | null) {
  open = fn;
}

/**
 * The bridge calls this when Privy's modal closes with nobody signed in.
 *
 * Without it a dismissed login left the funding screen spinning on "Signing you
 * in…" until the timeout — two minutes of a lie. The timeout stays as the
 * backstop for a tab that never reports anything.
 */
export function abandoned() {
  abandon?.();
}

/** Is a managed wallet configured at all? */
export const enabled = () => PRIVY_APP_ID !== "";

/** Is one connected right now? */
export const connected = () => wallet.isManaged();

/**
 * Get the player signed in, resolving once a wallet is actually attached.
 *
 * Resolves `true` immediately when Privy is off or already connected, so
 * callers can `await` unconditionally. The wait is on the wallet store rather
 * than on Privy's own promise: what onboarding needs is an address to fund, and
 * that only exists once `PrivyBridge` has built the client.
 */
export function signIn(timeoutMs = 120_000): Promise<boolean> {
  if (!enabled() || connected()) return Promise.resolve(true);
  const show = open;
  if (!show) return Promise.resolve(false);

  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      stop();
      abandon = null;
      clearTimeout(timer);
      resolve(ok);
    };
    const stop = wallet.subscribe(() => {
      if (wallet.isManaged()) finish(true);
    });
    abandon = () => finish(false);
    // Backstop, for a tab that never tells us either way.
    const timer = setTimeout(() => finish(false), timeoutMs);
    show();
  });
}
