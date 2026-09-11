"use client";

/**
 * Hands Privy's embedded wallet to `lib/dreamdex/wallet.ts`.
 *
 * Privy is React context; the wallet store is not, because the SDK trader, the
 * order helpers and the withdraw form all need a signer outside a component.
 * This is the one place the two meet: when Privy has an embedded wallet, build a
 * `WalletClient` over its EIP-1193 provider and attach it; when the user logs
 * out, detach.
 *
 * `resetTrader()` on both edges matters. The SDK trader is built once and holds
 * its own nonce counter — left alive across a login it would keep signing as the
 * previous wallet.
 *
 * Renders nothing.
 */

import { useEffect } from "react";
import {
  getEmbeddedConnectedWallet,
  useModalStatus,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { createWalletClient, custom, type Address } from "viem";
import { useLatest } from "@/lib/react/hooks";
import { CHAIN } from "@/lib/dreamdex/config";
import { resetTrader } from "@/lib/dreamdex/trader";
import * as signin from "@/lib/dreamdex/signin";
import * as wallet from "@/lib/dreamdex/wallet";

export default function PrivyBridge() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  // Onboarding asks for a sign-in through `signin.ts`, which exists so it never
  // has to import Privy. This is the half that supplies the modal.
  useEffect(() => {
    signin.register(login);
    return () => signin.register(null);
  }, [login]);

  /*
   * A dismissed login has to be reported, not waited out.
   *
   * `login()` opens a modal and returns; nothing rejects when the player closes
   * it. Watching the modal shut while still unauthenticated is what turns
   * "changed their mind" into an answer, instead of two minutes of "Signing you
   * in…" and then a timeout.
   */
  const { isOpen } = useModalStatus();
  useEffect(() => {
    if (isOpen || !ready || authenticated) return;
    signin.abandoned();
  }, [isOpen, ready, authenticated]);

  const embedded = getEmbeddedConnectedWallet(wallets);
  // An id, not the object: `useWallets` returns fresh objects every render, and
  // an effect keyed on one re-runs forever.
  const address = embedded?.address ?? null;
  const walletsRef = useLatest(wallets);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !address) {
      wallet.detachManaged();
      resetTrader();
      return;
    }

    let cancelled = false;
    void (async () => {
      const current = getEmbeddedConnectedWallet(walletsRef.current);
      if (!current) return;
      const provider = await current.getEthereumProvider();
      if (cancelled) return;
      wallet.attachManaged(
        address as Address,
        createWalletClient({
          account: address as Address,
          chain: CHAIN,
          transport: custom(provider),
        }),
      );
      resetTrader();
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, address, walletsRef]);

  return null;
}
