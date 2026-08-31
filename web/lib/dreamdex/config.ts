/**
 * Where the app talks to Somnia.
 *
 * Every constant here is measured or shipped, not guessed — see
 * `claude-docs/TESTNET_FACTS.md`. Addresses come from the SDK's baked-in
 * deployment manifest rather than being hardcoded, because the manifest carries
 * more contracts than the public docs list and moves with the release.
 */

import {
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { Address } from "viem";

export const CHAIN = somniaShannon;
export const ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
export const PRICE_FEED = SOMNIA_TESTNET_PRICE_FEED;

export const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
export const WS_RPC_URL = "wss://api.infra.testnet.somnia.network/ws";
export const HTTP_RPC_URL = CHAIN.rpcUrls.default.http[0];

/**
 * The collateral every binary market settles in. **6 decimals on testnet, 18 on
 * mainnet** — a 10^12 difference, so this is read from the deployment rather
 * than assumed anywhere downstream.
 */
export const COLLATERAL = {
  address: ADDRESSES.collateral as Address,
  symbol: "tUSDC",
  decimals: 6,
} as const;

/** Native gas token on Shannon. */
export const GAS = { symbol: "STT", decimals: 18 } as const;

const EXPLORER = CHAIN.blockExplorers.default.url;
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER}/address/${address}`;

/**
 * The only two STT faucets we point people at. Telegram gives 50× more and
 * needs no group join — the deep link opens a DM with the bot directly.
 */
export const STT_FAUCETS = [
  {
    id: "telegram",
    name: "Somnia faucet bot",
    detail: "50 STT every 24h · no group join",
    href: "https://t.me/somnia_helper_bot",
  },
  {
    id: "google",
    name: "Google Cloud faucet",
    detail: "1 STT per day",
    href: "https://cloud.google.com/application/web3/faucet/somnia/shannon",
  },
] as const;

/**
 * Gas ceilings.
 *
 * A ceiling here is not a cost — it is a **balance requirement**. The SDK signs
 * with fixed fees (`maxFeePerGas` 60 gwei) and the node rejects a transaction
 * unless `balance >= gasLimit * maxFeePerGas`, whatever it actually spends. The
 * SDK's own default of 10,000,000 demands **0.6 STT just to sign**, which a
 * freshly sponsored wallet does not have — its first trade fails with a bare
 * `-32000 insufficient balance`.
 *
 * So the ceiling is set per call rather than once, because the two paths cost
 * very different amounts:
 *
 * - **Taking** the book: 253k–795k observed. 2,000,000 is ample and keeps the
 *   balance requirement at 0.12 STT, which is what makes onboarding cheap.
 * - **Resting** an order on the book: writing into the book costs far more. A
 *   2,000,000 ceiling was measured running out at **1,969,851 used** and
 *   reverting with no decodable reason — the signature of an out-of-gas, not a
 *   contract error. 8,000,000 gives real headroom at 0.48 STT.
 */
export const GAS_LIMIT = 2_000_000n;

/** Resting an order writes into the book — see the note above. */
export const MAKER_GAS_LIMIT = 8_000_000n;

/**
 * Measured burn is ~0.004 STT per transaction (see TESTNET_FACTS §Q8), so this
 * is hundreds of trades — enough that a funded player never thinks about gas.
 * It must also clear the **maker** reserve of 0.48 STT, or a player could fund a
 * wallet and still be unable to rest an order.
 */
export const TOPUP_AMOUNT_STT = "1.5";
// ── Collateral grants ───────────────────────────────────────────────────────

/**
 * What a new player starts with, in tUSDC.
 *
 * Small on purpose. The token's own faucet will mint anyone any amount, so the
 * number is not a scarcity mechanism — it is the shape of the game. A stake is
 * about $0.50, so 500 is a few hundred rounds: enough to learn the console and
 * feel a streak, not so much that nothing counts.
 */
export const SIGNUP_GRANT = 500;

/** Topped up by this much once a week, on request. */
export const WEEKLY_GRANT = 100;

/** How long between grants. */
export const GRANT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Below this, the wallet is topped up on sight.
 *
 * It must sit **above the maker reserve** (0.48 STT), not just above zero. A
 * threshold of 0.05 left a wallet able to take the book but not rest an order,
 * with nothing to trigger a refill — the resting order just failed with a bare
 * "insufficient balance". Measured the hard way.
 */
export const TOPUP_THRESHOLD_STT = "0.6";
