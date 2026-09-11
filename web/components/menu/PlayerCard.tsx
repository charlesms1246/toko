"use client";

/**
 * The player card — the menu's masthead.
 *
 * The reference opens its menu with a gold-bordered card carrying the player's
 * identity and their record. This is that card, with one rule: every figure on
 * it is computed from the wallet's real on-chain rounds (`lib/dreamdex/stats`),
 * and a figure with no source is left OUT rather than printed as a zero.
 *
 * So there is no rank badge — the leaderboard we can compute is a sample of
 * recent pools, not a venue-wide standing, and a "#6" drawn from it would be a
 * claim we cannot make. There is no X handle chip — we store no X handle. And
 * in Demo Mode the record half of the card does not render at all: a demo
 * player's plays are paper, and the chain record behind these numbers belongs
 * to a wallet that has never traded.
 */

import Image from "next/image";
import { Pencil, Share2 } from "lucide-react";
import TapTarget from "@/components/ui/TapTarget";
import { formatUsd } from "@/lib/api/math";
import type { Stats } from "@/lib/dreamdex/stats";

function Figure({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Image src={icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
      <span className="tnum text-[15px] font-black leading-none">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </span>
    </div>
  );
}

export default function PlayerCard({
  handle,
  stats,
  demoing,
}: {
  handle: string;
  stats: Stats;
  demoing: boolean;
}) {
  // Nothing settled means nothing to report. Rather than a card of zeroes, the
  // record half stays folded away until the chain has something to say.
  const hasRecord = !demoing && stats.played > 0;
  const netPnl = stats.netPnl;
  // Return is net P&L against what was staked to earn it. Undefined until
  // something has actually been staked.
  const returnPct = stats.volume > 0 ? (netPnl / stats.volume) * 100 : null;

  return (
    <div className="card-neo card-neo-active rounded-card relative mb-5 p-4">
      <div className="flex items-center gap-3">
        {/* Initials, not an avatar image: nothing in the app can set one, so a
            picture slot here would be a hole waiting for a feature. */}
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500 text-base font-black text-black">
          {handle.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold leading-tight">
            @{handle}
          </div>
          <div className="text-[11px] font-bold text-text-3">
            {demoing ? "Demo · paper play" : "Somnia testnet"}
          </div>
        </div>
        <TapTarget
          href="/menu/share"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-line-strong)] text-text-2"
          aria-label="Share your card"
        >
          <Share2 size={16} />
        </TapTarget>
        <TapTarget
          href="/menu/username"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-line-strong)] text-text-2"
          aria-label="Edit your handle"
        >
          <Pencil size={16} />
        </TapTarget>
      </div>

      {hasRecord && (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            {/* Best multiple is won rounds only — a multiple on a losing ticket
                was never collected — so it is absent until one is won. */}
            {stats.bestMultiple > 0 && (
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-3">
                  Biggest win
                </div>
                <div className="tnum text-[38px] font-black leading-none text-brand-500">
                  {stats.bestMultiple.toFixed(2)}x
                </div>
              </div>
            )}
            <div className="shrink-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-3">
                Net P&amp;L
              </div>
              <div
                className={`tnum text-lg font-black leading-none ${
                  netPnl >= 0 ? "text-up" : "text-down"
                }`}
              >
                {formatUsd(netPnl, true)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-line)] pt-3">
            <Figure
              icon="/assets/icons/icon-plays.webp"
              label="Plays"
              value={String(stats.played)}
            />
            {returnPct != null && (
              <Figure
                icon="/assets/icons/icon-return.webp"
                label="Return"
                value={`${returnPct > 0 ? "+" : ""}${returnPct.toFixed(0)}%`}
              />
            )}
            <Figure
              icon="/assets/icons/icon-streak.webp"
              label="Streak"
              value={String(stats.currentStreak)}
            />
          </div>
        </>
      )}
    </div>
  );
}
