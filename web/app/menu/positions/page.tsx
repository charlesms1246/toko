"use client";

/**
 * Positions across every market, and claiming the settled ones.
 *
 * Deliberately no live mark here: valuing an open position means reading that
 * market's book, and this list spans many markets. The mark lives on the trading
 * screen, where the book for the window in play is already loaded. What this
 * screen is for is seeing everything at once and claiming what settled.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { EmptyState, MenuSection, StatTile } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import { useToast } from "@/components/ui/Toast";
import { COLLATERAL, explorerTx } from "@/lib/dreamdex/config";
import * as portfolio from "@/lib/dreamdex/portfolio";
import * as redeem from "@/lib/dreamdex/redeem";
import * as wallet from "@/lib/dreamdex/wallet";

const KIND_LABEL: Record<portfolio.PositionKind, string> = {
  live: "Live",
  winner: "Won",
  voided: "Voided",
  loser: "Lost",
};

export default function PositionsPage() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const { positions, error, at } = useSyncExternalStore(
    portfolio.subscribe,
    portfolio.getSnapshot,
    portfolio.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    return portfolio.startPolling();
  }, []);

  const toClaim = portfolio.claimable(positions);
  const expected = toClaim.reduce((sum, p) => sum + p.redeemable, 0n);

  const claim = useCallback(async () => {
    setBusy(true);
    // Read the claim set fresh: the derived array is rebuilt every render, so
    // closing over it would both trip the compiler rules and risk acting on a
    // stale list after the poll has moved on.
    const now = portfolio.claimable(portfolio.getSnapshot().positions);
    const summary = await redeem.claimAll(now);
    setBusy(false);
    if (summary.lastHash) setLastTx(summary.lastHash);
    if (summary.claimed > 0) {
      toast(
        `Claimed ${summary.claimed} · +${portfolio.contracts(summary.expected).toFixed(2)} ${COLLATERAL.symbol}`,
        "win",
      );
      void wallet.refresh();
      void portfolio.load();
    } else {
      toast(summary.errors[0] ?? "Nothing was claimed", "lose");
    }
  }, [toast]);

  const live = positions.filter((p) => p.kind === "live");
  const settled = positions.filter((p) => p.kind !== "live");

  if (!at && !error) return <EmptyState>Reading your positions…</EmptyState>;

  return (
    <>
      {error && (
        <p className="mb-4 rounded-2xl border border-[var(--color-line)] px-4 py-3 text-[11px] text-down">
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-3 gap-2">
        <StatTile label="Live" value={String(live.length)} />
        <StatTile label="To claim" value={String(toClaim.length)} tone="up" />
        <StatTile
          label="Worth"
          value={`${portfolio.contracts(expected).toFixed(2)}`}
          tone="brand"
        />
      </div>

      {toClaim.length > 0 && (
        <TapTarget
          haptic="high"
          disabled={busy}
          className="mb-6 w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"
          onClick={() => void claim()}
        >
          {busy
            ? "Claiming…"
            : `Claim ${toClaim.length} · +${portfolio.contracts(expected).toFixed(2)} ${COLLATERAL.symbol}`}
        </TapTarget>
      )}

      {positions.length === 0 && !error && (
        <EmptyState>No positions yet. Trade a window to open one.</EmptyState>
      )}

      {live.length > 0 && (
        <MenuSection title="Open">
          {live.map((p) => (
            <Row key={`${p.marketId}-${p.outcomeIndex}`} position={p} />
          ))}
        </MenuSection>
      )}

      {settled.length > 0 && (
        <MenuSection title="Settled">
          {settled.map((p) => (
            <Row key={`${p.marketId}-${p.outcomeIndex}`} position={p} />
          ))}
        </MenuSection>
      )}

      {lastTx && (
        <a
          href={explorerTx(lastTx)}
          target="_blank"
          rel="noreferrer"
          className="block px-1 text-[11px] text-text-3"
        >
          Last claim {lastTx.slice(0, 16)}… ↗
        </a>
      )}
    </>
  );
}

function Row({ position }: { position: portfolio.Position }) {
  const tone =
    position.kind === "winner"
      ? "text-up"
      : position.kind === "loser"
        ? "text-down"
        : position.kind === "voided"
          ? "text-[var(--color-premium-500)]"
          : "text-text-2";

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">
          {position.asset} {position.interval}{" "}
          <span className={position.outcomeIndex === 0 ? "text-up" : "text-down"}>
            {position.outcomeIndex === 0 ? "UP" : "DOWN"}
          </span>
        </div>
        <div className="text-[11px] text-text-3">
          {portfolio.contracts(position.balance).toFixed(3)} contracts ·{" "}
          {new Date(position.expiry * 1000).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-black ${tone}`}>
          {KIND_LABEL[position.kind]}
        </div>
        {position.redeemable > 0n && (
          <div className="text-[11px] font-bold tabular-nums text-up">
            +{portfolio.contracts(position.redeemable).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
