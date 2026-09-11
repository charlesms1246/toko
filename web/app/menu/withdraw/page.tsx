"use client";

/**
 * Send tUSDC out of the embedded wallet.
 *
 * A real ERC-20 transfer, signed by the burner key. This is the counterpart to
 * exporting the key: a player who wants their testnet balance somewhere else can
 * move it without handling the key at all.
 */

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  formatUnits,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import TapTarget from "@/components/ui/TapTarget";
import { MenuRow } from "@/components/menu/MenuUI";
import { useToast } from "@/components/ui/Toast";
import { CHAIN, COLLATERAL, GAS_LIMIT, explorerTx } from "@/lib/dreamdex/config";
import * as wallet from "@/lib/dreamdex/wallet";

const erc20 = parseAbi(["function transfer(address to, uint256 value) returns (bool)"]);

export default function WithdrawPage() {
  const toast = useToast();
  const state = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const balance = Number(state.collateral) / 10 ** COLLATERAL.decimals;
  // What MAX writes. Formatted from the raw balance, so it is the balance
  // exactly: `toFixed(2)` rounds half up, which can land above the balance and
  // make the form reject its own MAX, and rounds down otherwise, stranding dust
  // that MAX is there to sweep.
  const maxAmount = formatUnits(state.collateral, COLLATERAL.decimals);
  const value = Number(amount);
  const valid =
    Number.isFinite(value) && value > 0 && value <= balance && isAddress(to);

  const send = useCallback(async () => {
    // Whoever signs — a burner's key or a managed wallet's provider. This used
    // to build a client from the raw key, which a managed wallet does not have.
    const client = wallet.signer();
    const from = wallet.getSnapshot().address;
    if (!client || !from || !valid) return;
    setBusy(true);
    try {
      const hash = await client.writeContract({
        account: from,
        chain: CHAIN,
        address: COLLATERAL.address,
        abi: erc20,
        functionName: "transfer",
        args: [to as Address, parseUnits(amount, COLLATERAL.decimals)],
        gas: GAS_LIMIT,
      });
      setLastTx(hash);
      setAmount("");
      toast(`Sent ${value.toFixed(2)} ${COLLATERAL.symbol}`, "win");
      await wallet.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message.split("\n")[0] : "Transfer failed",
        "lose",
      );
    } finally {
      setBusy(false);
    }
  }, [amount, to, valid, value, toast]);

  return (
    <>
      <div className="surface-skeuo rounded-card mb-5 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          Available
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          {wallet.formatCollateral(state.collateral)}
        </div>
        <div className="mt-1 text-[11px] text-text-3">{COLLATERAL.symbol}</div>
      </div>

      <label className="mb-2 block px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">
        Amount
      </label>
      <div className="rounded-card mb-3 flex items-center gap-2 border border-[var(--color-line-strong)] bg-black/40 px-4 py-3.5">
        <span className="text-lg font-bold text-text-3">$</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          className="w-full bg-transparent text-lg font-bold tabular-nums outline-none placeholder:text-text-3"
        />
        <button
          type="button"
          className="shrink-0 rounded-full border border-[var(--color-line-strong)] px-3 py-1 text-[11px] font-bold text-text-2"
          onClick={() => setAmount(maxAmount)}
        >
          MAX
        </button>
      </div>

      <label className="mb-2 block px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">
        Destination
      </label>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value.trim())}
        placeholder="0x…"
        spellCheck={false}
        className="rounded-card mb-6 w-full border border-[var(--color-line-strong)] bg-black/40 px-4 py-3.5 font-mono text-[13px] font-bold outline-none placeholder:text-text-3"
      />

      <TapTarget
        className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"
        disabled={!valid || busy}
        haptic="high"
        onClick={() => void send()}
      >
        {busy ? "Sending…" : "Withdraw"}
      </TapTarget>

      {lastTx && (
        <div className="mt-4">
          <MenuRow
            label="Last withdrawal"
            value={`${lastTx.slice(0, 10)}…↗`}
            href={explorerTx(lastTx)}
            external
          />
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-text-3">
        A real transfer on Somnia testnet, signed by this device&apos;s wallet.
        Check the destination — it cannot be undone.
      </p>
    </>
  );
}
