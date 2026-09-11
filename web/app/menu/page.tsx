"use client";

import Image from "next/image";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import PlayerCard from "@/components/menu/PlayerCard";
import AchievementRings from "@/components/menu/AchievementRings";
import TapTarget from "@/components/ui/TapTarget";
import { useEffect, useSyncExternalStore } from "react";
import { useBalance, useUser } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import * as statsStore from "@/lib/dreamdex/stats";
import * as wallet from "@/lib/dreamdex/wallet";
import * as demo from "@/lib/demo";

export default function MenuHub() {
  const user = useUser();
  const { stats } = useSyncExternalStore(
    statsStore.subscribe,
    statsStore.getSnapshot,
    statsStore.getServerSnapshot,
  );
  /**
   * THE BALANCE COMES THROUGH THE EXECUTION SEAM, not straight off the wallet.
   *
   * `useBalance` reads whichever ledger is live — the paper one in Demo Mode,
   * the chain one otherwise. Reading `wallet.getSnapshot().collateral` here
   * bypassed the seam, so a demo player saw the console say $100.00 and this
   * card say $0.00 in the same breath, against a real address they had never
   * funded. The seam exists precisely so the two cannot disagree.
   */
  const balance = useBalance();
  const { active: demoing } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
    void statsStore.load();
  }, []);

  return (
    <>
      <PlayerCard handle={user.handle} stats={stats} demoing={demoing} />

      {/* The balance card: a raised card with the balance set very large. The
          player's initials moved up to the player card — one identity mark on
          the screen, not two. */}
      <div className="card-neo rounded-card relative mb-5 p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">
          My balance
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-0.5">
            <span className="text-xl font-black text-text-3">$</span>
            <span className="tnum truncate text-[34px] font-black leading-none text-text">
              {formatCollateral(balance)}
            </span>
          </div>
          <Image
            src="/assets/icons/chip-logo.webp"
            alt="tUSDC"
            width={22}
            height={22}
            className="shrink-0"
          />
        </div>
        {/* In Demo Mode there is no address worth naming. A wallet exists, but
            it has never been funded or traded, and printing it under a paper
            balance invites the reader to believe the two are connected. */}
        <div className="mt-2 truncate text-[11px] font-bold text-text-3">
          {demoing
            ? "Demo · paper balance"
            : `${user.address.slice(0, 10)}…${user.address.slice(-6)}`}
        </div>

        {/* The money actions live ON the card, as the reference does — the
            balance and the two things you can do to it in one object, rather
            than a figure here and a list row three sections down. Deposit goes
            to the wallet screen, which is where topping up actually happens. */}
        <div className="mt-4 flex items-center gap-2">
          <TapTarget
            href="/menu/wallet"
            className="grid h-11 flex-1 place-items-center rounded-full bg-brand-500 text-[14px] font-extrabold text-black"
            haptic="high"
          >
            Deposit
          </TapTarget>
          <TapTarget
            href="/menu/withdraw"
            className="grid h-11 flex-1 place-items-center rounded-full border border-[var(--color-line-strong)] text-[14px] font-bold text-text-2"
          >
            Withdraw
          </TapTarget>
        </div>
      </div>

      {/* Achievements are chain-derived and wallet-scoped, so in Demo Mode
          they stay off the hub entirely — the same reason /menu/achievements
          is gated there. */}
      {!demoing && <AchievementRings stats={stats} />}

      <MenuSection title="Wallet">
        <MenuRow
          icon="/assets/icons/chip-logo.webp"
          label="Somnia wallet"
          href="/menu/wallet"
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
