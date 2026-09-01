"use client";

import Image from "next/image";
import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useEffect, useSyncExternalStore } from "react";
import { useUser } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import * as statsStore from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";
import { formatUsd } from "@/lib/api/math";

export default function MenuHub() {
  const user = useUser();
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );
  const { stats } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
    void statsStore.load();
  }, []);

  const netPnl = stats.netPnl;

  return (
    <>
      {/* The balance card, ported from the reference's menu kit: a raised
          card with the handle above and the balance set very large. */}
      <div className="card-neo rounded-card relative mb-5 p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">
          My balance
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-black text-black">
              {user.handle.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex min-w-0 items-baseline gap-0.5">
              <span className="text-xl font-black text-text-3">$</span>
              <span className="tnum truncate text-[34px] font-black leading-none text-text">
                {formatCollateral(walletState.collateral)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Image
              src="/assets/icons/chip-logo.webp"
              alt="tUSDC"
              width={22}
              height={22}
            />
          </div>
        </div>
        <div className="mt-2 truncate text-[11px] font-bold text-text-3">
          @{user.handle} · {user.address.slice(0, 10)}…{user.address.slice(-6)}
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

      <MenuSection title="Markets">
        <MenuRow
          icon="/assets/icons/icon-plays.webp"
          label="Live windows"
          href="/menu/markets"
        />
        <MenuRow
          icon="/assets/icons/icon-history.webp"
          label="Positions"
          href="/menu/positions"
        />
        <MenuRow
          icon="/assets/icons/icon-plays.webp"
          label="Open duels"
          href="/menu/duels"
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
