"use client";

import { useState } from "react";
import Image from "next/image";
import TapTarget from "@/components/ui/TapTarget";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { useBalance, useStoreActions } from "@/lib/api/hooks";
import { FAUCET_AMOUNT, requestFaucet } from "@/lib/api/store";
import { useToast } from "@/components/ui/Toast";

const PRESETS = [25, 50, 100, 250];

export default function DepositPage() {
  const balance = useBalance();
  const actions = useStoreActions();
  const toast = useToast();
  const [amount, setAmount] = useState(50);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-4 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          Balance
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Image
            src="/assets/icons/chip-logo.webp"
            alt="USDC"
            width={22}
            height={22}
          />
          <span className="text-3xl font-black tabular-nums">
            {balance.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-text-3">
          Chips are USDC on Somnia testnet
        </div>
      </div>

      <MenuSection title="Add chips">
        <div className="grid grid-cols-4 gap-2 p-3">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={`rounded-xl py-2.5 text-sm font-black tabular-nums transition ${
                amount === preset
                  ? "bg-brand-500 text-black"
                  : "border border-[var(--color-line-strong)] text-text-2"
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
        <div className="p-3 pt-0">
          <TapTarget
            className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black"
            haptic="high"
            onClick={() => {
              actions.deposit(amount);
              toast(`Deposited $${amount.toFixed(2)}`, "win");
            }}
          >
            Deposit ${amount}
          </TapTarget>
        </div>
      </MenuSection>

      <MenuSection title="Testnet faucet">
        <MenuRow
          label={`Request $${FAUCET_AMOUNT} USDC`}
          value="60s cooldown"
          onClick={() => {
            const result = requestFaucet();
            if (result.ok) toast(`Faucet sent $${FAUCET_AMOUNT}`, "win");
            else toast("Faucet is cooling down — try again shortly.", "lose");
          }}
        />
      </MenuSection>

      <p className="px-1 text-[11px] leading-relaxed text-text-3">
        In the live app this screen bridges from any chain through LI.FI and
        settles into USDC on Somnia. Here it credits the demo balance directly.
      </p>
    </>
  );
}
