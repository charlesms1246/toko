"use client";

import { useState } from "react";
import TapTarget from "@/components/ui/TapTarget";
import { useBalance, useUser } from "@/lib/api/hooks";
import { withdraw } from "@/lib/api/store";
import { useToast } from "@/components/ui/Toast";

export default function WithdrawPage() {
  const balance = useBalance();
  const user = useUser();
  const toast = useToast();
  const [amount, setAmount] = useState("");

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= balance;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          Available
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          ${balance.toFixed(2)}
        </div>
      </div>

      <label className="mb-2 block px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">
        Amount
      </label>
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--color-line-strong)] bg-white/5 px-4 py-3">
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
          onClick={() => setAmount(String(balance.toFixed(2)))}
        >
          MAX
        </button>
      </div>

      <label className="mb-2 block px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">
        Destination
      </label>
      <div className="mb-6 truncate rounded-2xl border border-[var(--color-line)] bg-white/[.03] px-4 py-3 font-mono text-xs text-text-2">
        {user.address}
      </div>

      <TapTarget
        className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"
        disabled={!valid}
        haptic="high"
        onClick={() => {
          const result = withdraw(value);
          if (result.ok) {
            toast(`Withdrew $${value.toFixed(2)}`, "win");
            setAmount("");
          } else {
            toast("Not enough chips for that withdrawal.", "lose");
          }
        }}
      >
        Withdraw
      </TapTarget>

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-text-3">
        Withdrawals settle to your Somnia address as USDC. This demo moves the
        balance locally and records a transaction.
      </p>
    </>
  );
}
