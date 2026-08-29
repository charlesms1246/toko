"use client";

/**
 * The `SomniaMarkets` exchange, lazily constructed once per browser session.
 *
 * The SDK hydrates a consistent indexer snapshot and then materialises later
 * blocks from chain logs over a single WebSocket, so one instance is meant to be
 * shared — two would mean two sockets and two copies of the live store. The
 * socket opens on first chain I/O, so simply importing this costs nothing.
 *
 * Server-side rendering never touches it: every accessor returns null off the
 * browser rather than constructing something that would open a socket during a
 * render.
 */

import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { ADDRESSES, CHAIN, INDEXER_URL, PRICE_FEED, WS_RPC_URL } from "./config";

let exchange: SomniaMarkets | null = null;

export function getExchange(): SomniaMarkets | null {
  if (typeof window === "undefined") return null;
  if (!exchange) {
    exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: CHAIN,
      wsRpcUrl: WS_RPC_URL,
      addresses: ADDRESSES,
      priceFeed: PRICE_FEED,
    });
  }
  return exchange;
}

/**
 * The read/watch tier. Typed loosely on purpose: the SDK narrows indexer rows
 * only at its own boundary, and pretending to a stricter shape here would be a
 * fiction the compiler could not check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getClient = (): any | null => getExchange()?.client ?? null;
