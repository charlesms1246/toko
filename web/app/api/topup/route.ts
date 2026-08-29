/**
 * Gas sponsorship.
 *
 * There is no paymaster on Somnia and session transactions need a pre-funded
 * account anyway, so we sponsor gas ourselves: the treasury sends a player's
 * embedded wallet enough STT to trade with, and they never see a funding step.
 *
 * The treasury key is **server-side only**. It is deliberately not prefixed
 * `NEXT_PUBLIC_`, because a treasury key in the browser bundle could be drained
 * by anyone who opened devtools.
 *
 * Set `TREASURY_PRIVATE_KEY` in `web/.env` to enable this. Without it the route
 * reports itself unavailable and the UI falls back to the public faucets — the
 * feature is genuinely off rather than pretending to work.
 */

import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHAIN,
  HTTP_RPC_URL,
  TOPUP_AMOUNT_STT,
  TOPUP_THRESHOLD_STT,
} from "@/lib/dreamdex/config";

const AMOUNT = parseEther(TOPUP_AMOUNT_STT);
const THRESHOLD = parseEther(TOPUP_THRESHOLD_STT);

/**
 * One top-up per address per hour. In memory, so it resets on redeploy and is
 * per-instance — enough to stop a loop draining the treasury, not a substitute
 * for real abuse handling if this ever holds value.
 */
const COOLDOWN_MS = 60 * 60 * 1000;
const lastTopUp = new Map<string, number>();

function treasuryKey(): `0x${string}` | null {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as `0x${string}`) : null;
}

export async function POST(request: Request) {
  const key = treasuryKey();
  if (!key) {
    return NextResponse.json(
      { error: "Gas sponsorship is not configured — use a faucet below." },
      { status: 503 },
    );
  }

  let address: string;
  try {
    ({ address } = (await request.json()) as { address: string });
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Not a valid address" }, { status: 400 });
  }

  const seen = lastTopUp.get(address.toLowerCase());
  if (seen && Date.now() - seen < COOLDOWN_MS) {
    const mins = Math.ceil((COOLDOWN_MS - (Date.now() - seen)) / 60_000);
    return NextResponse.json(
      { error: `Already topped up — try again in ${mins} min.` },
      { status: 429 },
    );
  }

  const publicClient = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });

  // Don't spend on someone who can already pay their own gas.
  const balance = await publicClient.getBalance({ address: address as Address });
  if (balance >= THRESHOLD) {
    return NextResponse.json({ skipped: true, reason: "Already funded" });
  }

  const account = privateKeyToAccount(key);
  const treasury = await publicClient.getBalance({ address: account.address });
  if (treasury < AMOUNT) {
    return NextResponse.json(
      { error: "Treasury is empty — use a faucet below." },
      { status: 503 },
    );
  }

  try {
    const wallet = createWalletClient({ account, chain: CHAIN, transport: http(HTTP_RPC_URL) });
    const hash = await wallet.sendTransaction({ to: address as Address, value: AMOUNT });
    await publicClient.waitForTransactionReceipt({ hash });
    lastTopUp.set(address.toLowerCase(), Date.now());
    return NextResponse.json({ hash });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.split("\n")[0] : "Top-up failed" },
      { status: 502 },
    );
  }
}
