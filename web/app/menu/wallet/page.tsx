"use client";

/**
 * The real wallet — everything on this screen comes from Shannon.
 *
 * A new player is funded during onboarding, so this screen is the manual path:
 * topping up again, taking the collateral faucet, and exporting the key.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { useToast } from "@/components/ui/Toast";
import {
  COLLATERAL,
  GAS,
  STT_FAUCETS,
  WEEKLY_GRANT,
  explorerAddress,
  explorerTx,
} from "@/lib/dreamdex/config";
import * as wallet from "@/lib/dreamdex/wallet";
import { useIsMounted } from "@/lib/react/hooks";
import { useNow } from "@/lib/games/useRound";

/** How long until the next weekly claim, in the coarsest useful unit. */
function untilNext(at: number, now: number) {
  const ms = at - now;
  if (ms <= 0) return "ready";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d`;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `${hours}h`;
}

export default function WalletPage() {
  const toast = useToast();
  const state = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const [busy, setBusy] = useState<"gas" | "collateral" | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const mounted = useIsMounted();
  // Ticks so the countdown moves, and so readiness is never decided by reading
  // the clock mid-render.
  const now = useNow(30_000);

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
  }, []);

  // The schedule lives in local storage, so it is only knowable on the client.
  const grant = mounted ? wallet.grantStatus() : null;
  const grantReady = grant != null && now >= grant.nextAt;

  const fundGas = useCallback(async () => {
    setBusy("gas");
    const result = await wallet.requestGas();
    setBusy(null);
    if (result.ok) {
      if (result.hash) setLastTx(result.hash);
      toast(`Gas topped up · ${GAS.symbol}`, "win");
    } else toast(result.reason ?? "Top-up unavailable", "lose");
  }, [toast]);

  const fundCollateral = useCallback(async () => {
    setBusy("collateral");
    const result = await wallet.requestCollateral();
    setBusy(null);
    if (result.ok) {
      if (result.hash) setLastTx(result.hash);
      toast(`Received ${result.amount} ${COLLATERAL.symbol}`, "win");
    } else toast(result.reason ?? "Not available yet", "lose");
  }, [toast]);

  const address = state.address;
  const lowGas = wallet.needsGas(state.gas);

  return (
    <>
      <div className="mb-5 rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          {COLLATERAL.symbol} · Somnia testnet
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          {state.ready ? wallet.formatCollateral(state.collateral) : "—"}
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[11px]">
          <span className="text-text-3">Gas</span>
          <span
            className={`font-bold tabular-nums ${lowGas && state.ready ? "text-down" : "text-text-2"}`}
          >
            {state.ready ? `${wallet.formatGas(state.gas)} ${GAS.symbol}` : "—"}
          </span>
        </div>
        {state.error && (
          <p className="mt-2 text-[11px] text-down">{state.error}</p>
        )}
      </div>

      <MenuSection title="Address">
        <button
          type="button"
          className="w-full border-b border-[var(--color-line)] px-4 py-3.5 text-left last:border-b-0"
          onClick={() => {
            if (!address) return;
            void navigator.clipboard?.writeText(address);
            toast("Address copied", "win");
          }}
        >
          <span className="break-all font-mono text-xs text-text-2">
            {address ?? "generating…"}
          </span>
        </button>
        {address && (
          <MenuRow
            label="View on explorer"
            value="↗"
            href={explorerAddress(address)}
            external
          />
        )}
      </MenuSection>

      <MenuSection title="Funding">
        <MenuRow
          label={busy === "gas" ? "Requesting…" : `Top up ${GAS.symbol} for gas`}
          value={lowGas ? "needed" : "ok"}
          onClick={busy ? undefined : fundGas}
        />
        <MenuRow
          label={
            busy === "collateral"
              ? "Minting…"
              : grant?.kind === "weekly"
                ? `Weekly ${WEEKLY_GRANT} ${COLLATERAL.symbol}`
                : `Claim your ${grant?.amount ?? ""} ${COLLATERAL.symbol}`
          }
          value={
            lowGas
              ? "needs gas"
              : !grant
                ? "—"
                : grantReady
                  ? "ready"
                  : untilNext(grant.nextAt, now)
          }
          onClick={busy || !grantReady ? undefined : fundCollateral}
        />
        <MenuRow label="Refresh balances" onClick={() => void wallet.refresh()} />
        {lastTx && (
          <MenuRow
            label="Last funding tx"
            value={`${lastTx.slice(0, 8)}…↗`}
            href={explorerTx(lastTx)}
            external
          />
        )}
      </MenuSection>

      <MenuSection title={`${GAS.symbol} faucets`}>
        {STT_FAUCETS.map((faucet) => (
          <MenuRow
            key={faucet.id}
            label={faucet.name}
            value={faucet.detail}
            href={faucet.href}
            external
          />
        ))}
      </MenuSection>

      <MenuSection title="Private key">
        {revealed ? (
          <button
            type="button"
            className="w-full px-4 py-3.5 text-left"
            onClick={() => {
              const key = wallet.exportKey();
              if (!key) return;
              void navigator.clipboard?.writeText(key);
              toast("Private key copied", "win");
            }}
          >
            <span className="break-all font-mono text-[11px] text-text-2">
              {wallet.exportKey()}
            </span>
          </button>
        ) : (
          <MenuRow
            label="Reveal private key"
            value="tap"
            onClick={() => setRevealed(true)}
          />
        )}
      </MenuSection>

      <div className="rounded-2xl border border-[var(--color-premium-500)] bg-white/[.03] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-premium-500)]">
          Testnet burner
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-text-3">
          This key is generated in your browser and stored there. It holds testnet
          {` ${GAS.symbol} `}and {COLLATERAL.symbol} only — never send real funds
          to it. Clearing site data destroys it, so export the key first if you
          want to keep the address.
        </p>
      </div>
    </>
  );
}
