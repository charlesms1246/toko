"use client";

/**
 * The public challenge board.
 *
 * Every open duel, from anyone, takeable by anyone — there is no invite list and
 * no private match. A link is a shortcut to a row on this board, not a claim on
 * it.
 *
 * There is also no backend behind this. The board **is** the order books: each
 * live window's resting orders are read on chain and filtered to the ones
 * carrying `DUEL_TAG` in their `userData`. So a challenge is discoverable the
 * moment it is posted, by people who were never sent anything, and it disappears
 * when it is taken or ages off — because that is what the book did.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, MenuSection } from "@/components/menu/MenuUI";
import * as coop from "@/lib/dreamdex/coop";
import * as markets from "@/lib/dreamdex/markets";
import * as wallet from "@/lib/dreamdex/wallet";

const mmss = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  return s >= 3600
    ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
    : s >= 60
      ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
      : `${s}s`;
};

export default function DuelsPage() {
  const [open, setOpen] = useState<coop.OpenChallenge[] | null>(null);

  useEffect(() => {
    wallet.ensureWallet();
    const stop = markets.startPolling(5000);
    let cancelled = false;

    const read = async () => {
      const rows = await coop.listOpen();
      if (!cancelled) setOpen(rows);
    };
    // The first read waits for the market list; after that it keeps itself fresh.
    const timer = setInterval(() => void read(), 8000);
    void read();

    return () => {
      cancelled = true;
      clearInterval(timer);
      stop();
    };
  }, []);

  if (open == null) return <EmptyState>Reading the books…</EmptyState>;

  if (!open.length) {
    return (
      <EmptyState>
        No open duels right now. Post one from the Duel game and it appears here
        for everyone.
      </EmptyState>
    );
  }

  return (
    <MenuSection title={`${open.length} open`}>
      {open.map((row) => {
        // You take the opposite side of whatever they took.
        const yours = row.challenge.side === "up" ? "DOWN" : "UP";
        const multiple = row.cost > 0 ? row.challenge.size / row.cost : 0;
        return (
          <Link
            key={`${row.window.marketId}-${row.challenge.orderId}`}
            href={`/c/${coop.encode(row.challenge)}`}
            className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">
                {row.window.asset}{" "}
                <span className={yours === "UP" ? "text-up" : "text-down"}>
                  {yours}
                </span>{" "}
                <span className="text-text-3">· {multiple.toFixed(2)}x</span>
              </span>
              <span className="block truncate text-[11px] text-text-3">
                {row.challenge.from.slice(0, 6)}…{row.challenge.from.slice(-4)} ·
                settles in {mmss(row.windowSecsLeft)}
              </span>
            </span>
            <span className="shrink-0 pl-3 text-right">
              <span className="block text-sm font-bold tabular-nums">
                ${row.cost.toFixed(2)}
              </span>
              <span className="block text-[11px] tabular-nums text-text-3">
                {mmss(row.offerSecsLeft)} left
              </span>
            </span>
          </Link>
        );
      })}
    </MenuSection>
  );
}
