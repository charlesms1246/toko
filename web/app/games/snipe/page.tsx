"use client";

/** Snipe — "The wall drifts in. Press when it is close." Lab / admin only. */

import { useEffect, useRef, useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { LabGate } from "@/components/games/LabShell";
import { useRequireAdmin } from "@/lib/games/lab";
import { useBalance, useStakeIndex, useStoreActions } from "@/lib/api/hooks";
import { SNIPE_MODEL, snipeMultiplier } from "@/lib/games/lab-models";
import { formatUsd } from "@/lib/api/math";
import { useToast } from "@/components/ui/Toast";
import { playLose, playTick, playWin } from "@/lib/sound";
import haptics from "@/lib/haptics";
import { TRADABLE_ASSETS } from "@/lib/api/prices";

type Phase = "idle" | "running" | "result";

export default function SnipePage() {
  const admin = useRequireAdmin();
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [speedIndex, setSpeedIndex] = useState(1);
  const [wall, setWall] = useState(0);
  const [outcome, setOutcome] = useState({ error: 0, multiplier: 0, pnl: 0 });

  const startedAt = useRef(0);
  const raf = useRef(0);
  const speed = [0.7, 1, 1.4, 1.9][speedIndex];
  const travelMs = SNIPE_MODEL.travelMs / speed;

  const finish = (error: number) => {
    cancelAnimationFrame(raf.current);
    const multiplier = snipeMultiplier(error);
    const payout = stake * multiplier;
    if (payout > 0) actions.deposit(payout);
    const pnl = payout - stake;
    setOutcome({ error, multiplier, pnl });
    setPhase("result");
    if (pnl >= 0) {
      playWin();
      haptics.outcome("win");
    } else {
      playLose();
      haptics.outcome("lose");
    }
    toast(
      multiplier > 0
        ? `${multiplier.toFixed(2)}x — ${formatUsd(pnl, true)}`
        : `Missed — ${formatUsd(pnl, true)}`,
      pnl >= 0 ? "win" : "lose",
    );
  };

  // The wall sweeps from 0 to 1; the mark sits at 0.78.
  const MARK = 0.78;

  useEffect(() => {
    if (phase !== "running") return;
    startedAt.current = performance.now();

    const frame = () => {
      const t = (performance.now() - startedAt.current) / travelMs;
      if (t >= 1) {
        // Never fired — the wall ran past.
        setWall(1);
        finish(1 - MARK);
        return;
      }
      setWall(t);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, travelMs]);

  const start = () => {
    try {
      actions.openLabPlay({
        game: "snipe",
        asset: TRADABLE_ASSETS[0],
        stake,
        side: "up",
        multiplier: 1,
      });
    } catch {
      toast("Not enough chips for that stake.", "lose");
      return;
    }
    setWall(0);
    setPhase("running");
    playTick();
  };

  useProgramConsole({
    main:
      phase === "running"
        ? { label: "FIRE", pulse: true, onPress: () => finish(wall - MARK) }
        : { label: "ARM", pulse: true, onPress: start },
    knob: {
      min: 0,
      max: 3,
      step: 1,
      value: speedIndex,
      label: "SPEED",
      format: (v) => ["SLOW", "NORMAL", "FAST", "BLUR"][v],
      onChange: (v) => phase !== "running" && setSpeedIndex(v),
    },
    numberWheel: {
      min: 0,
      max: ladder.length - 1,
      step: 1,
      value: stakeIndex,
      label: "USDC",
      format: (v) => `$${ladder[v]}`,
      onChange: (v) => phase !== "running" && setStakeIndex(v),
    },
    status: {
      left: phase === "running" ? "FIRE NOW" : "SNIPE",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: phase === "result",
  });

  if (!admin) return <LabGate />;

  if (phase === "result") {
    return (
      <ScreenRoot className="items-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {outcome.multiplier >= SNIPE_MODEL.maxMultiplier
            ? "Perfect shot"
            : outcome.multiplier > 0
              ? "Hit"
              : "Missed"}
        </div>
        <BigNumber
          value={formatUsd(outcome.pnl, true)}
          tone={outcome.pnl >= 0 ? "up" : "down"}
        />
        <div className="text-[11px] font-semibold text-text-2">
          {outcome.multiplier.toFixed(2)}x · off by{" "}
          {(Math.abs(outcome.error) * 100).toFixed(1)}%
        </div>
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-3">
      <ScreenHeader left="Snipe" right={`$${stake}`} />
      <div className="text-center text-[11px] font-semibold text-text-2">
        The wall drifts in. Press when it is close.
      </div>

      {/* Track: the mark is fixed, the wall sweeps toward it. */}
      <div className="relative h-14 w-full overflow-hidden rounded-lg border border-[var(--color-line)] bg-black/60">
        <div
          className="absolute inset-y-0 w-[3px] bg-brand-500"
          style={{ left: `${MARK * 100}%` }}
        />
        <div
          className="absolute inset-y-1 w-2 rounded-sm bg-[var(--color-viz-cyan)]"
          style={{
            left: `${wall * 100}%`,
            boxShadow: "0 0 12px var(--color-viz-cyan)",
          }}
        />
      </div>

      <ScreenRow
        label="Speed"
        value={["Slow", "Normal", "Fast", "Blur"][speedIndex]}
        tone="brand"
      />
      <ScreenRow label="Perfect pays" value={`${SNIPE_MODEL.maxMultiplier}x`} />
    </ScreenRoot>
  );
}
