"use client";

import { EmptyState } from "@/components/menu/MenuUI";
import { useTransactions } from "@/lib/api/hooks";

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  grant: "Chip grant",
  faucet: "Faucet",
  play: "Play",
  payout: "Payout",
};

export default function TransactionsPage() {
  const transactions = useTransactions();

  if (!transactions.length) {
    return <EmptyState>No transactions yet.</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)]">
      {transactions.map((tx) => {
        const amount = Number(tx.amount);
        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{KIND_LABEL[tx.kind]}</div>
              <div className="truncate font-mono text-[11px] text-text-3">
                {tx.digest ? `${tx.digest.slice(0, 18)}…` : tx.status}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-sm font-black tabular-nums ${
                  amount >= 0 ? "text-up" : "text-down"
                }`}
              >
                {amount >= 0 ? "+" : "-"}${Math.abs(amount).toFixed(2)}
              </div>
              <div className="text-[11px] text-text-3">
                {new Date(tx.at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
