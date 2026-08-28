"use client";

/**
 * Lucky — a one-touch directional bet with a multiplier you choose.
 *
 * The knob picks the payout (2/3/5/10x); the server derives the strike from a
 * volatility model so the implied win probability matches the multiple. The
 * action keys pick the side, the thumbwheel sizes the stake, and the main key
 * is PLAY before the round and CASH OUT during it.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import Sparkline from "@/components/games/Sparkline";
import CoinIcon from "@/components/games/CoinIcon";
import { useGameRound } from "@/lib/games/useGameRound";
import {
  useBalance,
  usePriceHistory,
  useSpot,
  useStakeIndex,
  useStoreActions,
} from "@/lib/api/hooks";
import { LUCKY_LADDER, formatPrice, formatUsd } from "@/lib/api/math";
import { ASSET_LOGOS, TRADABLE_ASSETS } from "@/lib/api/prices";
import type { Side } from "@/lib/api/types";

export default function LuckyPage() {
  const [asset, setAsset] = useState(TRADABLE_ASSETS[0]);
  const [multIndex, setMultIndex] = useState(0);
  const [side, setSide] = useState<Side>("up");

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("lucky");

  const multiplier = LUCKY_LADDER[multIndex];
  const { play, live, settled, secsLeft, progress } = round;

  const fire = (nextSide: Side) => {
    setSide(nextSide);
    if (live) return;
    round.open(() =>
      actions.openLucky({
        asset,
        stake,
        side: nextSide,
        multiplier,
      }),
    );
  };

  const strike = play?.market.strike ? Number(play.market.strike) : null;
  const markValue = play ? Number(play.markValue) : 0;
  const pnl = play ? Number(play.pnl) : 0;

  useProgramConsole({
    main: live
      ? {
          label: "CASH OUT",
          pulse: true,
          loading: play?.status === "pending",
          onPress: round.cashOut,
        }
      : {
          label: "PLAY",
          onPress: () => fire(side),
        },
    action1: {
      label: "LONG",
      display: { mode: "token", ticker: asset, logoSrc: ASSET_LOGOS[asset] },
      pulse: !live && side === "up",
      disabled: live,
      onPress: () => fire("up"),
    },
    action2: {
      label: "SHORT",
      pulse: !live && side === "down",
      disabled: live,
      onPress: () => fire("down"),
    },
    knob: {
      min: 0,
      max: LUCKY_LADDER.length - 1,
      step: 1,
      value: multIndex,
      label: "PAYOUT",
      format: (v) => `${LUCKY_LADDER[v]}x`,
      onChange: (v) => !live && setMultIndex(v),
    },
    numberWheel: {
      min: 0,
      max: ladder.length - 1,
      step: 1,
      value: stakeIndex,
      label: "USDC",
      format: (v) => `$${ladder[v]}`,
      onChange: (v) => !live && setStakeIndex(v),
    },
    status: {
      left: live ? `${secsLeft}s` : "LUCKY",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: settled,
  });

  // ── Settled ──────────────────────────────────────────────────────────────
  if (settled && play) {
    const won = play.status === "won" || play.status === "cashed_out";
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {play.status === "cashed_out" ? "Cashed out" : won ? "You won" : "Rekt"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
        <div className="text-[11px] font-semibold text-text-2">
          {multiplier}x · {asset} {play.params.side === "up" ? "long" : "short"}
        </div>
      </ScreenRoot>
    );
  }

  // ── Live ─────────────────────────────────────────────────────────────────
  if (live && play) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${asset} ${play.params.side === "up" ? "LONG" : "SHORT"}`}
          right={`${secsLeft}s`}
        />
        <BigNumber
          value={formatUsd(markValue)}
          tone={pnl >= 0 ? "up" : "down"}
        />
        <Sparkline
          points={points}
          height={54}
          tone={pnl >= 0 ? "up" : "down"}
          markers={
            strike
              ? [{ price: strike, color: "var(--color-brand-500)" }]
              : []
          }
        />
        <ScreenRow label="Strike" value={strike ? formatPrice(strike) : "—"} />
        <ScreenRow
          label="P&L"
          value={formatUsd(pnl, true)}
          tone={pnl >= 0 ? "up" : "down"}
        />
        <ScreenBar progress={progress} />
      </ScreenRoot>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader left="Lucky" right={`$${stake}`} />
      <div className="flex items-baseline justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-black tracking-tight text-text"
          onClick={() =>
            setAsset(
              TRADABLE_ASSETS[
                (TRADABLE_ASSETS.indexOf(asset) + 1) % TRADABLE_ASSETS.length
              ],
            )
          }
        >
          <CoinIcon asset={asset} />
          {asset}
        </button>
        <span className="text-sm font-bold tabular-nums text-text-2">
          ${formatPrice(price)}
        </span>
      </div>

      <Sparkline points={points} height={54} />

      <div className="flex items-center justify-center gap-1.5">
        {LUCKY_LADDER.map((mult, i) => (
          <span
            key={mult}
            className={`rounded-md px-2 py-1 text-[11px] font-black tabular-nums ${
              i === multIndex
                ? "bg-brand-500 text-black"
                : "text-text-3"
            }`}
          >
            {mult}x
          </span>
        ))}
      </div>

      <ScreenRow
        label="To win"
        value={formatUsd(stake * multiplier)}
        tone="brand"
      />
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {side === "up" ? "Long" : "Short"} · press play
      </div>
    </ScreenRoot>
  );
}
