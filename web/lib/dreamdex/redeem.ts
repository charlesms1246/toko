"use client";

/**
 * Claiming settled positions.
 *
 * A winning contract redeems for exactly 1 collateral unit — verified on chain
 * in Phase 0, where a position bought at 0.341 paid back `+1.000000` tUSDC.
 * Redemption is module-routed: the module pulls the winning tokens, finalizes
 * the market if nobody has yet, and settles through the BinarySettlement
 * singleton.
 *
 * Two things worth knowing:
 *
 * - **A losing position redeems successfully and pays zero.** There is no reason
 *   to spend gas on one, so `claimAll` skips them.
 * - **A voided market pays both sides at 0.5**, and each side is a separate
 *   redemption — claiming one does not claim the other.
 */

import { COLLATERAL } from "./config";
import { getClient } from "./client";
import { exportKey } from "./wallet";
import type { Position } from "./portfolio";

let trader: unknown = null;

function getTrader() {
  if (trader) return trader;
  const client = getClient();
  const key = exportKey();
  if (!client || !key) return null;
  trader = client.createTrader({ privateKey: key, decimals: COLLATERAL.decimals });
  return trader;
}

export interface RedeemResult {
  ok: boolean;
  hash?: string;
  error?: string;
}

export async function redeem(position: Position): Promise<RedeemResult> {
  const t = getTrader();
  if (!t) return { ok: false, error: "No wallet" };
  if (position.redeemable === 0n) {
    return { ok: false, error: "Nothing to claim on this position" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (t as any).redeem({
      marketId: position.marketId,
      amount: position.balance,
      outcomeIdx: position.outcomeIndex,
    });
    return { ok: true, hash: res.hash };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ok: false, error: message.replace(/^@somnia-chain\/markets-sdk: /, "") };
  }
}

export interface ClaimSummary {
  claimed: number;
  failed: number;
  /** Collateral expected back, raw. */
  expected: bigint;
  lastHash?: string;
  errors: string[];
}

/**
 * Claim every position worth claiming, one at a time.
 *
 * Sequential on purpose: the SDK tracks the nonce locally per trader, and firing
 * these in parallel would race that counter.
 */
export async function claimAll(positions: Position[]): Promise<ClaimSummary> {
  const summary: ClaimSummary = { claimed: 0, failed: 0, expected: 0n, errors: [] };

  for (const position of positions) {
    if (position.redeemable === 0n) continue;
    const result = await redeem(position);
    if (result.ok) {
      summary.claimed += 1;
      summary.expected += position.redeemable;
      summary.lastHash = result.hash;
    } else {
      summary.failed += 1;
      if (result.error) summary.errors.push(result.error);
    }
  }

  return summary;
}
