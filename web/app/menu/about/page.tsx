"use client";

import Image from "next/image";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { APP, LINKS } from "@/lib/api/fixtures";

export default function AboutPage() {
  return (
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <Image
          src="/assets/logos/toko-mark.svg"
          alt="TOKO"
          width={96}
          height={96}
          unoptimized
        />
        <h1 className="mt-4 font-display text-2xl font-bold">{APP.name}</h1>
        <p className="mt-1 text-sm font-semibold text-brand-500">
          {APP.tagline}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          {APP.description}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-[var(--color-down)]/40 bg-[var(--color-down)]/10 p-4">
        <p className="text-xs leading-relaxed text-text-2">
          <strong className="text-text">TOKO has no token.</strong> We have never
          launched one. Any coin, presale, or airdrop claiming to be TOKO is a
          scam.
        </p>
      </div>

      <MenuSection title="How it works">
        <MenuRow label="You trade DreamDEX Event Contracts" value="binary Up/Down" />
        <MenuRow label="Collateral is tUSDC" value="Somnia testnet" />
        <MenuRow label="Prices come from Somnia's on-chain oracle" value="EMA feed" />
        <MenuRow label="Windows settle on chain" value="1 tUSDC per winner" />
      </MenuSection>

      <MenuSection title="Links">
        <MenuRow label="Source" href={LINKS.github} />
        <MenuRow label="DreamDEX" href={LINKS.dreamdex} />
        <MenuRow label="Somnia docs" href={LINKS.somnia} />
      </MenuSection>

      <div className="flex flex-col items-center gap-2 py-4 opacity-70">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-3">
          Powered by
        </span>
        <Image
          src="/assets/logos/somnia-logo.png"
          alt="Somnia"
          width={28}
          height={28}
        />
        <span className="mt-2 text-[11px] text-text-3">By TOKO</span>
      </div>
    </>
  );
}
