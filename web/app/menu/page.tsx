"use client";

import Image from "next/image";
import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useBalance, useStats, useUser } from "@/lib/api/hooks";
import { formatUsd } from "@/lib/api/math";

export default function MenuHub() {
  const user = useUser();
  const balance = useBalance();
  const stats = useStats();
  const netPnl = Number(stats.netPnl);

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-lg font-black text-black">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-extrabold">
            @{user.username}
          </div>
          <div className="truncate text-xs text-text-3">
            {user.address.slice(0, 10)}…{user.address.slice(-6)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 py-1.5">
          <Image
            src="/assets/icons/chip-logo.webp"
            alt="USDC"
            width={16}
            height={16}
          />
          <span className="text-sm font-black tabular-nums">
            {balance.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <StatTile
          label="Net P&L"
          value={formatUsd(netPnl, true)}
          tone={netPnl >= 0 ? "up" : "down"}
        />
        <StatTile
          label="Win rate"
          value={`${(stats.winRate * 100).toFixed(0)}%`}
        />
        <StatTile label="Streak" value={String(stats.currentStreak)} tone="brand" />
      </div>

      <MenuSection title="Wallet">
        <MenuRow
          icon="/assets/icons/chip-logo.webp"
          label="Somnia wallet"
          href="/menu/wallet"
        />
        <MenuRow
          icon="/assets/icons/chip-logo.webp"
          label="Deposit"
          href="/menu/deposit"
        />
        <MenuRow
          icon="/assets/icons/icon-return.webp"
          label="Withdraw"
          href="/menu/withdraw"
        />
        <MenuRow
          icon="/assets/icons/icon-plays.webp"
          label="Transactions"
          href="/menu/transactions"
        />
      </MenuSection>

      <MenuSection title="Play">
        <MenuRow
          icon="/assets/icons/icon-history.webp"
          label="History"
          href="/menu/history"
        />
        <MenuRow
          icon="/assets/icons/leaderboard-icon.webp"
          label="Leaderboard"
          href="/menu/leaderboard"
        />
        <MenuRow
          icon="/assets/icons/icon-streak.webp"
          label="Achievements"
          href="/menu/achievements"
        />
        <MenuRow
          icon="/assets/icons/icon-referrals.webp"
          label="Referrals"
          href="/menu/referrals"
        />
        <MenuRow
          icon="/assets/icons/icon-plays.webp"
          label="Share your P&L"
          href="/menu/share"
        />
      </MenuSection>

      <MenuSection title="Console">
        <MenuRow
          icon="/assets/icons/icon-customize.webp"
          label="Customize"
          href="/menu/customize"
        />
        <MenuRow
          icon="/assets/icons/icon-settings.webp"
          label="Settings"
          href="/menu/settings"
        />
        <MenuRow
          icon="/assets/icons/icon-account-settings.webp"
          label="Account"
          href="/menu/account"
        />
        <MenuRow
          icon="/assets/icons/icon-about.webp"
          label="About"
          href="/menu/about"
        />
      </MenuSection>
    </>
  );
}
