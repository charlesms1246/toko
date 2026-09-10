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
import { exportKey } from "./wallet";

let trader: unknown = null;

export function getTrader() {
  if (trader) return trader;
  const client = getClient();
  const key = exportKey();
  if (!client || !key) return null;
  trader = client.createTrader({
    privateKey: key,
    decimals: COLLATERAL.decimals,
    // Without this the SDK's 10M default demands 0.6 STT of balance to sign.
    gas: GAS_LIMIT,
  });
  return trader;
}
