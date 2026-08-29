/**
 * On-chain activity for an address.
 *
 * Proxies the Shannon explorer's transaction list so the browser never has to
 * depend on the explorer's CORS policy, and normalises it into the few fields
 * the history screen actually shows.
 *
 * Only `txlist` is used. The explorer's token-transfer endpoints were unreliable
 * when this was built, so token amounts are decoded from the call data of the
 * methods we know instead of trusted to a second feed.
 */

import { NextResponse } from "next/server";
import { formatEther, formatUnits, isAddress } from "viem";
import { CHAIN, COLLATERAL } from "@/lib/dreamdex/config";

const EXPLORER_API = CHAIN.blockExplorers.default.apiUrl;

/** `faucet(uint256)` on the testnet collateral token. */
const FAUCET_SELECTOR = "0x57915897";

export interface ActivityRow {
  hash: string;
  at: number;
  label: string;
  /** Signed, human-readable. Empty when the transaction moved no value we can name. */
  amount: string;
  direction: "in" | "out" | "none";
  ok: boolean;
}

interface RawTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  input: string;
  isError: string;
  txreceipt_status: string;
}

function classify(tx: RawTx, self: string): ActivityRow {
  const at = Number(tx.timeStamp) * 1000;
  const ok = tx.isError === "0" && tx.txreceipt_status !== "0";
  const incoming = tx.to?.toLowerCase() === self;
  const value = BigInt(tx.value || "0");

  // tUSDC faucet — the amount is the single uint256 argument.
  if (
    tx.to?.toLowerCase() === COLLATERAL.address.toLowerCase() &&
    tx.input?.startsWith(FAUCET_SELECTOR)
  ) {
    const raw = BigInt(`0x${tx.input.slice(10)}`);
    return {
      hash: tx.hash,
      at,
      ok,
      label: `${COLLATERAL.symbol} faucet`,
      direction: "in",
      amount: `${Number(formatUnits(raw, COLLATERAL.decimals)).toLocaleString()} ${COLLATERAL.symbol}`,
    };
  }

  // A plain value transfer in or out.
  if (value > 0n && (!tx.input || tx.input === "0x")) {
    return {
      hash: tx.hash,
      at,
      ok,
      label: incoming ? "Gas top-up" : "Sent",
      direction: incoming ? "in" : "out",
      amount: `${Number(formatEther(value)).toFixed(4)} ${CHAIN.nativeCurrency.symbol}`,
    };
  }

  return {
    hash: tx.hash,
    at,
    ok,
    label: incoming ? "Received" : "Contract call",
    direction: value > 0n ? (incoming ? "in" : "out") : "none",
    amount: value > 0n ? `${Number(formatEther(value)).toFixed(4)} ${CHAIN.nativeCurrency.symbol}` : "",
  };
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Not a valid address" }, { status: 400 });
  }

  const url =
    `${EXPLORER_API}?module=account&action=txlist&address=${address}` +
    `&sort=desc&page=1&offset=50`;

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json({ error: `Explorer returned ${res.status}` }, { status: 502 });
    }
    const body = (await res.json()) as { result?: RawTx[] | string };
    // Blockscout answers "No transactions found" with a string result.
    const rows = Array.isArray(body.result)
      ? body.result.map((tx) => classify(tx, address.toLowerCase()))
      : [];
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reach the explorer" },
      { status: 502 },
    );
  }
}
