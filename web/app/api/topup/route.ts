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
 *
 * It is also the only place that can honestly count a referral. Every new player
 * passes through here exactly once — we pay for their first gas — so recording
 * the code they arrived with turns "who did I bring?" into something we actually
 * know, rather than a number that would have to be invented.
 */

import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

/** Drop entries the cooldown no longer covers, so the map cannot grow forever. */
function forgetExpired(now: number) {
  for (const [address, at] of lastTopUp) {
    if (now - at >= COOLDOWN_MS) lastTopUp.delete(address);
  }
}

/**
 * Who we funded, and which referral code they arrived with.
 *
 * On disk rather than in memory so a restart does not erase everyone's invites.
 * One entry per address, written the first time we pay for their gas — which is
 * once per player, because after that they can pay for themselves.
 */
const REFERRALS = join(process.cwd(), ".data", "referrals.json");

type Referrals = Record<string, { ref: string; at: number }>;

async function readReferrals(): Promise<Referrals> {
  try {
    return JSON.parse(await readFile(REFERRALS, "utf8")) as Referrals;
  } catch {
    return {};
  }
}

/**
 * What a code may look like: the same alphabet the username screen allows, or
 * the shortened address it falls back to. Anything else arrived from a hand-made
 * URL and is not written to disk.
 */
const REF_PATTERN = /^[a-zA-Z0-9_]{1,20}$/;

/**
 * Writes are chained rather than concurrent. This is a read-modify-write on one
 * JSON file, so two first-time funders landing together would otherwise read the
 * same object and the second write would drop the first entry.
 */
let writes: Promise<void> = Promise.resolve();

async function recordReferral(address: string, ref: string) {
  if (!REF_PATTERN.test(ref)) return;
  const run = writes.then(async () => {
    const all = await readReferrals();
    const key = address.toLowerCase();
    if (all[key]) return; // first funding only — never double-count a player
    all[key] = { ref: ref.toLowerCase(), at: Date.now() };
    await mkdir(dirname(REFERRALS), { recursive: true });
    await writeFile(REFERRALS, JSON.stringify(all), "utf8");
  });
  // The chain must survive a failed write; the caller still sees the error.
  writes = run.catch(() => {});
  return run;
}

/**
 * How many players a code has brought in.
 *
 * Deliberately just a count of funded wallets. There is no earnings figure
 * because there are no referral earnings — inventing one would be exactly the
 * thing this project refuses to do.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) return NextResponse.json({ invited: 0 });
  const all = await readReferrals();
  const wanted = ref.toLowerCase();
  const invited = Object.values(all).filter((r) => r.ref === wanted).length;
  return NextResponse.json({ invited });
}

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
  let ref: string | undefined;
  try {
    ({ address, ref } = (await request.json()) as { address: string; ref?: string });
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Not a valid address" }, { status: 400 });
  }

  const now = Date.now();
  forgetExpired(now);
  const seen = lastTopUp.get(address.toLowerCase());
  if (seen && now - seen < COOLDOWN_MS) {
    const mins = Math.ceil((COOLDOWN_MS - (now - seen)) / 60_000);
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
    if (ref) await recordReferral(address, ref);
    return NextResponse.json({ hash });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.split("\n")[0] : "Top-up failed" },
      { status: 502 },
    );
  }
}
