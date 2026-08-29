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
 * Gas ceiling for every write we sign.
 *
 * This is not a cost — it is a **balance requirement**. The SDK signs with fixed
 * fees (`maxFeePerGas` 60 gwei) and the node rejects a transaction unless
 * `balance >= gasLimit * maxFeePerGas`, whatever the transaction actually
 * spends. The SDK's own default of 10,000,000 therefore demands **0.6 STT just
 * to sign**, which a freshly sponsored wallet does not have — the first trade
 * fails with a bare `-32000 insufficient balance`.
 *
 * Observed usage is 253k–421k gas, so 2,000,000 is 5x headroom and brings the
 * requirement down to 0.12 STT.
 */
export const GAS_LIMIT = 2_000_000n;

/**
 * Measured burn is ~0.004 STT per transaction (see TESTNET_FACTS §Q8), so this
 * is roughly 125 trades — enough that a funded player never thinks about gas.
 * It must also stay comfortably above the `GAS_LIMIT` reserve above.
 */
export const TOPUP_AMOUNT_STT = "0.5";
/** Below this, the wallet is topped up on sight. */
export const TOPUP_THRESHOLD_STT = "0.05";
