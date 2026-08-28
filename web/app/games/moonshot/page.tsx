"use client";

/**
 * Moonshot — the high-multiple sibling of Lucky.
 *
 * Same directional structure, but you pick a *reach*: how far the price has to
 * travel. The aim readout shows how far away each target sits, and 25x exists
 * only here.
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
  useMoonshotAim,
  useStakeIndex,
  useStoreActions,
} from "@/lib/api/hooks";
import { MOONSHOT_LADDER, formatPrice, formatUsd } from "@/lib/api/math";
import { ASSET_LOGOS, TRADABLE_ASSETS } from "@/lib/api/prices";
import type { Side } from "@/lib/api/types";

export default function MoonshotPage() {
  const [asset, setAsset] = useState(TRADABLE_ASSETS[0]);
  const [reachIndex, setReachIndex] = useState(2);
  const [side, setSide] = useState<Side>("up");

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("moonshot");
  const { play, live, settled, secsLeft, progress } = round;

  const reach = MOONSHOT_LADDER[reachIndex];
  const aim = useMoonshotAim(asset);
  const offset = aim.find((level) => level.reach === reach)?.offsetFrac ?? 0;

  const strike = play?.market.strike ? Number(play.market.strike) : null;
  const markValue = play ? Number(play.markValue) : 0;
  const pnl = play ? Number(play.pnl) : 0;

  const fire = (nextSide: Side) => {
    setSide(nextSide);
    if (live) return;
    round.open(() =>
      actions.openMoonshot({ asset, stake, side: nextSide, reach }),
    );
  };

  useProgramConsole({
    main: live
      ? {
          label: "CASH OUT",
          pulse: true,
          loading: play?.status === "pending",
          onPress: round.cashOut,
        }
      : { label: "PLAY", onPress: () => fire(side) },
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
      max: MOONSHOT_LADDER.length - 1,
      step: 1,
      value: reachIndex,
      label: "REACH",
      format: (v) => `${MOONSHOT_LADDER[v]}x`,
      onChange: (v) => !live && setReachIndex(v),
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
      left: live ? `${secsLeft}s` : "MOONSHOT",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: settled,
  });

  if (settled && play) {
    const won = play.status === "won" || play.status === "cashed_out";
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {play.status === "cashed_out"
            ? "Cashed out"
            : won
              ? "Moonshot hit"
              : "Fell short"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
        <div className="text-[11px] font-semibold text-text-2">
          {reach}x · {asset} {play.params.side === "up" ? "long" : "short"}
        </div>
      </ScreenRoot>
    );
  }

  if (live && play) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${asset} ${play.params.side === "up" ? "LONG" : "SHORT"}`}
          right={`${secsLeft}s`}
        />
        <BigNumber value={formatUsd(markValue)} tone={pnl >= 0 ? "up" : "down"} />
        <Sparkline
          points={points}
          height={54}
          tone={pnl >= 0 ? "up" : "down"}
          markers={
            strike ? [{ price: strike, color: "var(--color-brand-500)" }] : []
          }
        />
        <ScreenRow label="Target" value={strike ? formatPrice(strike) : "—"} />
        <ScreenRow
          label="P&L"
          value={formatUsd(pnl, true)}
          tone={pnl >= 0 ? "up" : "down"}
        />
        <ScreenBar progress={progress} />
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader left="Moonshot" right={`$${stake}`} />
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

      <Sparkline
        points={points}
        height={50}
        markers={aim.map((level) => ({
          price: price * (1 + (side === "up" ? 1 : -1) * Math.abs(level.offsetFrac)),
          color:
            level.reach === reach
              ? "var(--color-brand-500)"
              : "var(--color-viz-line)",
        }))}
      />

      <div className="flex items-center justify-center gap-1">
        {MOONSHOT_LADDER.map((value, i) => (
          <span
            key={value}
            className={`rounded-md px-1.5 py-1 text-[11px] font-black tabular-nums ${
              i === reachIndex ? "bg-brand-500 text-black" : "text-text-3"
            }`}
          >
            {value}x
          </span>
        ))}
      </div>

      <ScreenRow
        label="Needs"
        value={`${(Math.abs(offset) * 100).toFixed(2)}% ${side === "up" ? "up" : "down"}`}
      />
      <ScreenRow label="To win" value={formatUsd(stake * reach)} tone="brand" />
    </ScreenRoot>
  );
}
