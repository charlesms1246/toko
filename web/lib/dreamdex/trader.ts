"use client";

/**
 * The one SDK trader for this wallet.
 *
 * The SDK tracks the nonce locally, per trader object. Two trader instances
 * built from the same key each keep their own counter and know nothing of each
 * other, so a claim sent while an order is in flight reuses or skips a nonce and
 * the transaction is rejected. Orders and redemptions both reach the chain
 * through this single instance so there is only ever one counter.
 */

import { COLLATERAL, GAS_LIMIT } from "./config";
import { getClient } from "./client";
import { exportKey, signer } from "./wallet";

let trader: unknown = null;

export function getTrader() {
  if (trader) return trader;
  const client = getClient();
  if (!client) return null;

  const common = {
    decimals: COLLATERAL.decimals,
    // Without this the SDK's 10M default demands 0.6 STT of balance to sign.
    gas: GAS_LIMIT,
  };

  /*
   * A local key is preferred when there IS one, and not for convenience.
   * `TraderConfig` takes either, but with a `privateKey` the SDK signs in
   * process and sends over its own WebSocket with
   * `realtime_sendRawTransaction` — one round trip to send and confirm. A
   * `walletClient` cannot do that: every write goes out through the provider
   * and then waits on a receipt separately.
   *
   * So the burner keeps the fast path, and a managed wallet pays a round trip
   * for never exposing its key. That is the trade, and it is the right way
   * round.
   */
  const key = exportKey();
  if (key) {
    trader = client.createTrader({ ...common, privateKey: key });
    return trader;
  }

  const walletClient = signer();
  if (!walletClient) return null;
  trader = client.createTrader({ ...common, walletClient });
  return trader;
}

/** Forget the trader, so the next call builds one for whoever signs now. */
export function resetTrader() {
  trader = null;
}
