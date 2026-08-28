"use client";

/** Rush — take the deal, or push for a better one. Lab / admin only. */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { LabGate } from "@/components/games/LabShell";
import { useRequireAdmin } from "@/lib/games/lab";
import {
  useBalance,
  useStakeIndex,
  useStoreActions,
} from "@/lib/api/hooks";
import { RUSH_MODEL, rushDeal } from "@/lib/games/lab-models";
import { formatUsd } from "@/lib/api/math";
import { useToast } from "@/components/ui/Toast";
import { playLose, playStepUp, playWin } from "@/lib/sound";
import haptics from "@/lib/haptics";
import { TRADABLE_ASSETS } from "@/lib/api/prices";

type Phase = "idle" | "offer" | "busted" | "taken";

export default function RushPage() {
  const admin = useRequireAdmin();
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [appetiteIndex, setAppetiteIndex] = useState(1);
  const [result, setResult] = useState(0);

  const appetite = [0.85, 1, 1.2, 1.45][appetiteIndex];
  const deal = rushDeal(round, appetite);

  const startRun = () => {
    // The stake is committed up front; the run either pays out or busts.
    try {
      actions.openLabPlay({
        game: "rush",
        asset: TRADABLE_ASSETS[0],
        stake,
        side: "up",
        multiplier: 1,
      });
    } catch {
      toast("Not enough chips for that stake.", "lose");
      return;
    }
    setRound(0);
    setResult(0);
    setPhase("offer");
  };

  const take = () => {
    const payout = stake * deal.multiplier;
    actions.deposit(payout);
    setResult(payout - stake);
    setPhase("taken");
    playWin();
    haptics.outcome("win");
    toast(`Took the deal — ${formatUsd(payout)}`, "win");
  };

  const push = () => {
    if (Math.random() < deal.survival) {
      playStepUp(round * 6);
      haptics.press("medium");
      setRound((r) => Math.min(RUSH_MODEL.maxRounds, r + 1));
      return;
    }
    setResult(-stake);
    setPhase("busted");
    playLose();
    haptics.outcome("lose");
    toast(`Busted — ${formatUsd(-stake, true)}`, "lose");
  };

  const running = phase === "offer";

  useProgramConsole({
    main: running
      ? { label: "TAKE", pulse: true, onPress: take }
      : { label: "DEAL", pulse: true, onPress: startRun },
    action1: {
      label: "PUSH",
      pulse: running,
      disabled: !running || round >= RUSH_MODEL.maxRounds,
      onPress: push,
    },
    knob: {
      min: 0,
      max: 3,
      step: 1,
      value: appetiteIndex,
      label: "APPETITE",
      format: (v) => ["LOW", "MED", "HIGH", "WILD"][v],
      onChange: (v) => !running && setAppetiteIndex(v),
    },
    numberWheel: {
      min: 0,
      max: ladder.length - 1,
      step: 1,
      value: stakeIndex,
      label: "USDC",
      format: (v) => `$${ladder[v]}`,
      onChange: (v) => !running && setStakeIndex(v),
    },
    status: {
      left: running ? `ROUND ${round + 1}` : "RUSH",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: phase === "taken" || phase === "busted",
  });

  if (!admin) return <LabGate />;

  if (phase === "taken" || phase === "busted") {
    return (
      <ScreenRoot className="items-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {phase === "taken" ? "Deal taken" : "Busted"}
        </div>
        <BigNumber
          value={formatUsd(result, true)}
          tone={result >= 0 ? "up" : "down"}
        />
        <div className="text-[11px] font-semibold text-text-2">
          {round + 1} round{round === 0 ? "" : "s"} deep
        </div>
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader
        left="Rush"
        right={running ? `${round + 1}/${RUSH_MODEL.maxRounds}` : `$${stake}`}
      />
      <div className="text-center text-[11px] font-semibold text-text-2">
        Take the deal, or push for a better one.
      </div>

      {running ? (
        <>
          <BigNumber value={`${deal.multiplier.toFixed(2)}x`} tone="brand" />
          <ScreenRow label="Pays" value={formatUsd(stake * deal.multiplier)} />
          <ScreenRow
            label="Push survives"
            value={`${(deal.survival * 100).toFixed(0)}%`}
            tone={deal.survival > 0.5 ? "up" : "down"}
          />
          <div className="flex justify-center gap-1 pt-1">
            {Array.from({ length: RUSH_MODEL.maxRounds }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-3 rounded-full ${
                  i <= round ? "bg-brand-500" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <ScreenRow
            label="Appetite"
            value={["Low", "Medium", "High", "Wild"][appetiteIndex]}
            tone="brand"
          />
          <ScreenRow
            label="Opening"
            value={`${rushDeal(0, appetite).multiplier.toFixed(2)}x`}
          />
          <div className="pt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
            Press deal to start
          </div>
        </>
      )}
    </ScreenRoot>
  );
}
