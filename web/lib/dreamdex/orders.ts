"use client";

/**
 * Placing and closing orders.
 *
 * Everything awkward about this venue is handled here so callers never have to
 * think about it. All of it was measured in Phase 0 — see
 * `claude-docs/TESTNET_FACTS.md`:
 *
 * - **`price` is the YES price on all four sides.** `BUY_NO` escrows
 *   `quantity × (1 − price)`, so a short sends a YES price and gets *more*
 *   aggressive by going *lower*. Getting this backwards inverts every short.
 * - **Price must stay inside `(0, 1)` on the tick grid** or the pool reverts
 *   `PriceOutOfBounds()`. Crossing hard on a near-certain side runs straight
 *   into that: NO at 0.998 is a YES price of 0.002.
 * - **`expireTimestampNs` is mandatory, in nanoseconds, and must not exceed the
 *   market's own expiry.** Passing it explicitly also skips a pre-send read.
 * - **An IOC that finds nothing reverts** with `ImmediateOrCancelNoFill()`
 *   rather than returning zero fills. On a thin book that is the *normal*
 *   outcome and must not read as an error.
 * - **Fills report `quantityFilled`, not `quantity`.**
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  maxUint256,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHAIN,
  COLLATERAL,
  GAS_LIMIT,
  HTTP_RPC_URL,
  MAKER_GAS_LIMIT,
} from "./config";
import { getClient } from "./client";
import { exportKey } from "./wallet";
import type { Window } from "./markets";

const ONE = BigInt(10 ** COLLATERAL.decimals);

/** The shared ERC-6909 singleton every outcome token lives on. */
export const OUTCOME_TOKEN = "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9" as Address;

const publicClient = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });

/** OrderBook `OrderType`: 0 rest, 1 fill-or-kill, 2 IOC, 3 post-only. */
export const ORDER_TYPE = { REST: 0, FOK: 1, IOC: 2, POST_ONLY: 3 } as const;

export type Side = "up" | "down";

export interface Grid {
  tick: bigint;
  lot: bigint;
  minQuantity: bigint;
}

/** Cached per pool — the grid is fixed for a pool's lifetime. */
const grids = new Map<string, Grid>();

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
]);

const poolAbi = parseAbi([
  "function getOrderBookParameters() view returns (uint256 tickSize, uint256 minQuantity, uint256 lotSize)",
]);

/**
 * Read the pool's price/size grid. One creator on Shannon stamps a 1.0-contract
 * minimum while the live pools use 0.001, so this is never assumed.
 */
export async function getGrid(pool: string): Promise<Grid> {
  const cached = grids.get(pool);
  if (cached) return cached;

  const [tick, minQuantity, lot] = (await publicClient.readContract({
    address: pool as Address,
    abi: poolAbi,
    functionName: "getOrderBookParameters",
  })) as [bigint, bigint, bigint];

  const grid = { tick, lot, minQuantity };
  grids.set(pool, grid);
  return grid;
}

/** Snap a YES price onto the grid and inside `(0, 1)`. */
export function snapPrice(price: bigint, tick: bigint): bigint {
  const snapped = (price / tick) * tick;
  if (snapped < tick) return tick;
  if (snapped > ONE - tick) return ONE - tick;
  return snapped;
}

/** Snap a size down onto the lot grid. Returns 0n when it rounds away. */
export function snapSize(size: bigint, grid: Grid): bigint {
  const snapped = (size / grid.lot) * grid.lot;
  return snapped < grid.minQuantity ? 0n : snapped;
}

let trader: unknown = null;

function getTrader() {
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

export interface OrderOutcome {
  ok: boolean;
  hash?: string;
  /** Contracts actually filled, raw. */
  filled: bigint;
  /** Average fill price in YES terms, raw. */
  fillPrice?: bigint;
  /** Set when nothing was there to trade against — expected, not an error. */
  noLiquidity?: boolean;
  error?: string;
}

/** The market's own expiry, in nanoseconds — the pool rejects anything later. */
const expiryNs = (w: Window) => BigInt(w.expiry) * 1_000_000_000n;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarise(res: any): OrderOutcome {
  const fills = (res.fills ?? []) as { quantityFilled: bigint; fillPrice: bigint }[];
  const filled = fills.reduce((sum, f) => sum + BigInt(f.quantityFilled ?? 0n), 0n);
  return {
    ok: filled > 0n,
    hash: res.hash,
    filled,
    fillPrice: fills[0]?.fillPrice,
  };
}

function asOutcome(err: unknown): OrderOutcome {
  const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
  if (message.includes("ImmediateOrCancelNoFill")) {
    return { ok: false, filled: 0n, noLiquidity: true };
  }
  return { ok: false, filled: 0n, error: message.replace(/^@somnia-chain\/markets-sdk: /, "") };
}

/**
 * Take the book on one side. `yesPrice` is the limit in YES terms whichever side
 * is being bought — see the note at the top of this file.
 */
export async function buy(
  window: Window,
  side: Side,
  yesPrice: bigint,
  size: bigint,
  gas: bigint = GAS_LIMIT,
): Promise<OrderOutcome> {
  const t = getTrader();
  if (!t) return { ok: false, filled: 0n, error: "No wallet" };

  const grid = await getGrid(window.poolAddress);
  const quantity = snapSize(size, grid);
  if (quantity === 0n) {
    return { ok: false, filled: 0n, error: "Below the pool's minimum size" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (t as any).placeOrder({
      pool: window.poolAddress,
      side: side === "up" ? "BUY_YES" : "BUY_NO",
      price: snapPrice(yesPrice, grid.tick),
      quantity,
      orderType: ORDER_TYPE.IOC,
      expireTimestampNs: expiryNs(window),
      gas,
      // Passing the pool's own metadata skips the pre-send reads that otherwise
      // run on every order.
      outcomeToken: OUTCOME_TOKEN,
      yesId: BigInt(window.yesTokenId),
      noId: BigInt(window.noTokenId),
      collateral: COLLATERAL.address,
    });
    return summarise(res);
  } catch (err) {
    return asOutcome(err);
  }
}

/**
 * Rest a bid on the book instead of taking one.
 *
 * This is what makes Pin and co-op play *maker* games: the order sits at the
 * called price and fills only if the market comes to it. Two consequences:
 *
 * - Escrow is locked for as long as it rests. It is released by a fill, a
 *   cancel, or the order ageing out.
 * - `expireTimestampNs` is pinned to the market's own expiry, which the pool
 *   requires anyway — so a resting order can never outlive the window it was
 *   placed in, and an unfilled one simply expires.
 */
export interface RestOptions {
  /**
   * When this offer ages off the book, in nanoseconds. Defaults to the market's
   * own expiry, which is also the ceiling — the pool rejects anything later.
   * Setting it shorter gives the order a real, protocol-enforced lifetime that
   * needs no client to be running.
   */
  expireNs?: bigint;
  /**
   * Opaque per-order data the pool stores and returns verbatim. The venue's
   * market maker uses small integers for its own bookkeeping; we use it to mark
   * an order as a TOKO challenge so the public list can find it.
   */
  userData?: bigint;
}

export async function rest(
  window: Window,
  side: Side,
  yesPrice: bigint,
  size: bigint,
  options: RestOptions = {},
): Promise<OrderOutcome & { orderId?: bigint }> {
  const t = getTrader();
  if (!t) return { ok: false, filled: 0n, error: "No wallet" };

  const grid = await getGrid(window.poolAddress);
  const quantity = snapSize(size, grid);
  if (quantity === 0n) {
    return { ok: false, filled: 0n, error: "Below the pool's minimum size" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (t as any).placeOrder({
      pool: window.poolAddress,
      side: side === "up" ? "BUY_YES" : "BUY_NO",
      price: snapPrice(yesPrice, grid.tick),
      quantity,
      orderType: ORDER_TYPE.REST,
      // Never past the market's own expiry — the pool rejects that outright.
      expireTimestampNs:
        options.expireNs && options.expireNs < expiryNs(window)
          ? options.expireNs
          : expiryNs(window),
      userData: options.userData ?? 0n,
      // Resting writes into the book and costs multiples of a taker order.
      gas: MAKER_GAS_LIMIT,
      outcomeToken: OUTCOME_TOKEN,
      yesId: BigInt(window.yesTokenId),
      noId: BigInt(window.noTokenId),
      collateral: COLLATERAL.address,
    });
    // A resting order may cross on arrival if the book moved to meet it; both
    // outcomes are normal, so report the fill and the id it rested under.
    return { ...summarise(res), ok: true, orderId: res.orderId };
  } catch (err) {
    return asOutcome(err);
  }
}

/** Pull a resting order. The exact escrow comes back to the wallet. */
export async function cancel(pool: string, orderId: bigint): Promise<OrderOutcome> {
  const t = getTrader();
  if (!t) return { ok: false, filled: 0n, error: "No wallet" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (t as any).cancelOrder({ pool, orderId });
    return { ok: true, filled: 0n, hash: res.hash };
  } catch (err) {
    return asOutcome(err);
  }
}

/** Order ids this wallet has resting on a pool, straight from the pool. */
export async function ownOpenOrders(pool: string): Promise<bigint[]> {
  const key = exportKey();
  if (!key) return [];
  return openOrdersOf(pool, privateKeyToAccount(key).address);
}

/**
 * Order ids *any* address has resting on a pool.
 *
 * Co-op needs this: the person opening a challenge link has to know whether the
 * challenger's bid is still on the book, and that is somebody else's order.
 */
export async function openOrdersOf(pool: string, address: Address): Promise<bigint[]> {
  const client = getClient();
  if (!client) return [];
  try {
    return (await client.getOwnOpenOrdersOnchain(pool, address)) as bigint[];
  } catch {
    return [];
  }
}

/** Sell a held position back into the book. */
export async function sell(
  window: Window,
  side: Side,
  yesPrice: bigint,
  size: bigint,
): Promise<OrderOutcome> {
  const t = getTrader();
  if (!t) return { ok: false, filled: 0n, error: "No wallet" };

  const grid = await getGrid(window.poolAddress);
  const quantity = snapSize(size, grid);
  if (quantity === 0n) {
    return { ok: false, filled: 0n, error: "Below the pool's minimum size" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (t as any).placeOrder({
      pool: window.poolAddress,
      side: side === "up" ? "SELL_YES" : "SELL_NO",
      price: snapPrice(yesPrice, grid.tick),
      quantity,
      orderType: ORDER_TYPE.IOC,
      expireTimestampNs: expiryNs(window),
      outcomeToken: OUTCOME_TOKEN,
      yesId: BigInt(window.yesTokenId),
      noId: BigInt(window.noTokenId),
      collateral: COLLATERAL.address,
    });
    return summarise(res);
  } catch (err) {
    return asOutcome(err);
  }
}

/**
 * Approve the collateral to a pool ahead of time.
 *
 * Escrow is pulled by the pool, so a buy needs an ERC-20 allowance to *that*
 * pool — and every window is a new pool, so without this every round pays for an
 * `approve` before its order: two transactions and roughly twice the wait.
 * Calling this while the console is idle moves that cost off the press.
 *
 * Cheap to call repeatedly: the SDK caches approved (token, spender) pairs per
 * trader, so after the first success it is a no-op with no request at all.
 */
const approved = new Set<string>();

export async function preApprove(pool: string): Promise<void> {
  const key = exportKey();
  if (!key) return;
  const spender = pool.toLowerCase();
  if (approved.has(spender)) return;

  try {
    const account = privateKeyToAccount(key);
    const allowance = (await publicClient.readContract({
      address: COLLATERAL.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, pool as Address],
    })) as bigint;

    // Anything short of a full allowance gets topped up to max, matching what
    // the SDK's own on-demand approval does.
    if (allowance > ONE * 1_000_000n) {
      approved.add(spender);
      return;
    }

    const wallet = createWalletClient({
      account,
      chain: CHAIN,
      transport: http(HTTP_RPC_URL),
    });
    const hash = await wallet.writeContract({
      address: COLLATERAL.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool as Address, maxUint256],
      gas: GAS_LIMIT,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    approved.add(spender);
  } catch {
    // Not fatal — `placeOrder` approves on demand if this did not land.
  }
}

/** Human helpers — the UI works in contracts and a 0–1 price. */
export const toRawSize = (contracts: number) =>
  BigInt(Math.round(contracts * Number(ONE)));
export const toRawPrice = (price: number) => BigInt(Math.round(price * Number(ONE)));
export const fromRaw = (raw: bigint) => Number(raw) / Number(ONE);
