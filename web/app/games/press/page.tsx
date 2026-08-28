"use client";

/** Press — "Tighten your winning band, or fold." Lab / admin only. */

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
import { PRESS_MODEL, pressBand, pressMultiplier } from "@/lib/games/lab-models";
import { formatPrice, formatUsd } from "@/lib/api/math";
import { TRADABLE_ASSETS } from "@/lib/api/prices";
import { playStepUp } from "@/lib/sound";

export default function PressPage() {
  const admin = useRequireAdmin();
  const [asset] = useState(TRADABLE_ASSETS[0]);
  const [presses, setPresses] = useState(0);

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("press");
  const { play, live, settled, secsLeft, progress } = round;

  const half = pressBand(presses);
  const multiplier = pressMultiplier(presses);
  const upper = price * (1 + half);
  const lower = price * (1 - half);
  const pnl = play ? Number(play.pnl) : 0;
  const canPress = !live && presses < PRESS_MODEL.maxPresses;

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.cashOut }
      : {
          label: "LOCK IN",
          pulse: true,
          onPress: () => {
            round.open(() =>
              actions.openLabPlay({
                game: "press",
                asset,
                stake,
                side: "up",
                multiplier,
              }),
            );
            setPresses(0);
          },
        },
    action1: {
      label: "PRESS",
      pulse: canPress,
      disabled: !canPress,
      onPress: () => {
        playStepUp(presses * 6);
        setPresses((p) => Math.min(PRESS_MODEL.maxPresses, p + 1));
      },
    },
    action2: {
      label: "FOLD",
      disabled: live || presses === 0,
      onPress: () => setPresses(0),
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
      left: live ? `${secsLeft}s` : `PRESS ${presses}/${PRESS_MODEL.maxPresses}`,
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
          {won ? "Band held" : "Pressed too far"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader left="Press" right={live ? `${secsLeft}s` : `$${stake}`} />
      <div className="text-center text-[11px] font-semibold text-text-2">
        Tighten your winning band, or fold.
      </div>
      <Sparkline
        points={points}
        height={54}
        band={{ lower, upper, color: "var(--color-up)" }}
        markers={[
          { price: upper, color: "var(--color-line-strong)" },
          { price: lower, color: "var(--color-line-strong)" },
        ]}
      />
      <div className="flex justify-center gap-1">
        {Array.from({ length: PRESS_MODEL.maxPresses }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-4 rounded-full ${
              i < presses ? "bg-brand-500" : "bg-white/15"
            }`}
          />
        ))}
      </div>
      <ScreenRow label="Band" value={`±${(half * 100).toFixed(2)}%`} />
      <ScreenRow label="Upper" value={formatPrice(upper)} />
      <ScreenRow label="Lower" value={formatPrice(lower)} />
      <ScreenRow label="Pays" value={`${multiplier.toFixed(2)}x`} tone="brand" />
      {live && <ScreenBar progress={progress} />}
    </ScreenRoot>
  );
}
