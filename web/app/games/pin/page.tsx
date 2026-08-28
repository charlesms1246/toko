"use client";

/** Pin — "Name the price. Closest call wins." Lab / admin only. */

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
import { PIN_MODEL, pinMultiplier } from "@/lib/games/lab-models";
import { formatPrice, formatUsd } from "@/lib/api/math";
import { TRADABLE_ASSETS } from "@/lib/api/prices";

export default function PinPage() {
  const admin = useRequireAdmin();
  const [asset] = useState(TRADABLE_ASSETS[0]);
  const [offsetIndex, setOffsetIndex] = useState(4);

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("pin");
  const { play, live, settled, secsLeft, progress } = round;

  const offset = PIN_MODEL.offsets[offsetIndex];
  const called = price * (1 + offset);
  const multiplier = pinMultiplier(offset);
  const pnl = play ? Number(play.pnl) : 0;

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.cashOut }
      : {
          label: "CALL IT",
          pulse: true,
          onPress: () =>
            round.open(() =>
              actions.openLabPlay({
                game: "pin",
                asset,
                stake,
                side: offset >= 0 ? "up" : "down",
                multiplier,
              }),
            ),
        },
    knob: {
      min: 0,
      max: PIN_MODEL.offsets.length - 1,
      step: 1,
      value: offsetIndex,
      label: "CALL",
      format: (v) => `${(PIN_MODEL.offsets[v] * 100).toFixed(1)}%`,
      onChange: (v) => !live && setOffsetIndex(v),
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
    status: { left: live ? `${secsLeft}s` : "PIN", right: `$${balance.toFixed(2)}` },
    lightShow: settled,
  });

  if (!admin) return <LabGate />;

  if (settled && play) {
    const won = play.status === "won" || play.status === "cashed_out";
    return (
      <ScreenRoot className="items-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {won ? "Nailed it" : "Missed the pin"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader left="Pin" right={live ? `${secsLeft}s` : `$${stake}`} />
      <div className="text-center text-[11px] font-semibold text-text-2">
        Name the price. Closest call wins.
      </div>
      <Sparkline
        points={points}
        height={54}
        markers={[{ price: called, color: "var(--color-brand-500)" }]}
      />
      <ScreenRow label="Spot" value={formatPrice(price)} />
      <ScreenRow label="Your call" value={formatPrice(called)} tone="brand" />
      <ScreenRow label="Pays" value={`${multiplier.toFixed(2)}x`} tone="brand" />
      {live && <ScreenBar progress={progress} />}
    </ScreenRoot>
  );
}
