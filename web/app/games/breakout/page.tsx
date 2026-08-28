"use client";

/** Breakout — call the break before it happens. Lab / admin only. */

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
import { LabGate } from "@/components/games/LabShell";
import { useRequireAdmin } from "@/lib/games/lab";
import { useGameRound } from "@/lib/games/useGameRound";
import {
  useBalance,
  usePriceHistory,
  useSpot,
  useStakeIndex,
  useStoreActions,
} from "@/lib/api/hooks";
import { BREAKOUT_MODEL, breakoutMultiplier } from "@/lib/games/lab-models";
import { formatPrice, formatUsd } from "@/lib/api/math";
import { TRADABLE_ASSETS } from "@/lib/api/prices";
import type { Side } from "@/lib/api/types";

export default function BreakoutPage() {
  const admin = useRequireAdmin();
  const [asset] = useState(TRADABLE_ASSETS[0]);
  const [tierIndex, setTierIndex] = useState(2);
  const [side, setSide] = useState<Side>("up");

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("breakout");
  const { play, live, settled, secsLeft, progress } = round;

  const threshold = BREAKOUT_MODEL.thresholds[tierIndex];
  const multiplier = breakoutMultiplier(threshold);
  const upper = price * (1 + threshold);
  const lower = price * (1 - threshold);
  const pnl = play ? Number(play.pnl) : 0;

  const fire = (nextSide: Side) => {
    setSide(nextSide);
    if (live) return;
    round.open(() =>
      actions.openLabPlay({
        game: "breakout",
        asset,
        stake,
        side: nextSide,
        multiplier,
      }),
    );
  };

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.cashOut }
      : { label: "PLAY", onPress: () => fire(side) },
    action1: {
      label: "BREAK UP",
      pulse: !live && side === "up",
      disabled: live,
      onPress: () => fire("up"),
    },
    action2: {
      label: "BREAK DOWN",
      pulse: !live && side === "down",
      disabled: live,
      onPress: () => fire("down"),
    },
    knob: {
      min: 0,
      max: BREAKOUT_MODEL.thresholds.length - 1,
      step: 1,
      value: tierIndex,
      label: "BREAK",
      format: (v) => `${(BREAKOUT_MODEL.thresholds[v] * 100).toFixed(1)}%`,
      onChange: (v) => !live && setTierIndex(v),
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
      left: live ? `${secsLeft}s` : "BREAKOUT",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: settled,
  });

  if (!admin) return <LabGate />;

  if (settled && play) {
    const won = play.status === "won" || play.status === "cashed_out";
    return (
      <ScreenRoot className="items-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {won ? "It broke" : "Held the range"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader left="Breakout" right={live ? `${secsLeft}s` : `$${stake}`} />
      <div className="text-center text-[11px] font-semibold text-text-2">
        Call the break before it happens.
      </div>
      <Sparkline
        points={points}
        height={54}
        markers={[
          {
            price: side === "up" ? upper : lower,
            color: "var(--color-brand-500)",
          },
        ]}
        band={{ lower, upper, color: "var(--color-viz-cyan)" }}
      />
      <ScreenRow
        label="Target"
        value={formatPrice(side === "up" ? upper : lower)}
        tone="brand"
      />
      <ScreenRow label="Pays" value={`${multiplier.toFixed(2)}x`} tone="brand" />
      {live && <ScreenBar progress={progress} />}
    </ScreenRoot>
  );
}
