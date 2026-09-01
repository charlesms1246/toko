"use client";

/**
 * On-chain history for the player's wallet.
 *
 * Every row is a real transaction, read back from the Shannon explorer rather
 * than from anything the app remembers doing — so it stays right across devices
 * and includes anything sent to the address from outside.
 */

import { useEffect, useSyncExternalStore } from "react";
import { EmptyState, MenuRow } from "@/components/menu/MenuUI";
import { explorerAddress, explorerTx } from "@/lib/dreamdex/config";
import * as wallet from "@/lib/dreamdex/wallet";
import * as activity from "@/lib/dreamdex/activity";

export default function TransactionsPage() {
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const { rows, error } = useSyncExternalStore(
    activity.subscribe,
    activity.getSnapshot,
    activity.getServerSnapshot,
  );

  const address = walletState.address;

  useEffect(() => {
    const target = wallet.ensureWallet();
    if (target) void activity.load(target);
  }, []);

  if (!address || rows === null) {
    return <EmptyState>Reading the chain…</EmptyState>;
  }

  return (
    <>
      {error && (
        <p className="surface-skeuo rounded-card mb-4 px-4 py-3 text-[13px] font-bold text-down">
          {error}
        </p>
      )}

      {rows.length === 0 && !error ? (
        <EmptyState>
          Nothing on chain yet. Fund the wallet to see activity here.
        </EmptyState>
      ) : (
        <div className="mb-5 flex flex-col gap-1.5">
          {rows.map((tx) => (
            <a
              key={tx.hash}
              href={explorerTx(tx.hash)}
              target="_blank"
              rel="noreferrer"
              className="surface-skeuo rounded-card flex items-center gap-3 p-4 transition-transform active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {tx.label}
                  {!tx.ok && <span className="ml-2 text-[11px] text-down">failed</span>}
                </div>
                <div className="truncate font-mono text-[11px] text-text-3">
                  {tx.hash.slice(0, 20)}…
                </div>
              </div>
              <div className="text-right">
                {tx.amount && (
                  <div
                    className={`text-sm font-black tabular-nums ${
                      tx.direction === "in"
                        ? "text-up"
                        : tx.direction === "out"
                          ? "text-down"
                          : "text-text-2"
                    }`}
                  >
                    {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
                    {tx.amount}
                  </div>
                )}
                <div className="text-[11px] text-text-3">
                  {new Date(tx.at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <MenuRow
        label="Full history on explorer"
        value="↗"
        href={explorerAddress(address)}
        external
      />
    </>
  );
}
