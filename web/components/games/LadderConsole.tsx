"use client";

/**
 * The roll ladder on the console — Press and Breakout.
 *
 * Each rung is a real Minute round staked with the previous rung's payout. Win
 * and the console offers PRESS or FOLD; lose and the ladder ends there.
 *
 * Press lets you pick a side each rung. Breakout locks the side chosen at the
 * start, which is what makes it a call on the move continuing rather than a
 * fresh bet every window.
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
import { useRollLadder } from "@/lib/games/useRollLadder";
import type { Side } from "@/lib/games/useMinuteRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";

export default function LadderConsole({
  title,
  lockSide,
}: {
  title: string;
  lockSide: boolean;
}) {
  const ladder = useRollLadder(lockSide);
  const { round } = ladder;
  const [side, setSide] = useState<Side>("up");

  const live = round.status === "open";
  const ask = book.best(side === "up" ? round.book.yesAsks : round.book.noAsks);

  useProgramConsole({
    main: ladder.canPress
      ? { label: "PRESS", pulse: true, onPress: ladder.press }
      : live
        ? { label: "RIDING", disabled: true }
        : {
            label: round.status === "pending" ? "…" : "START",
            loading: round.status === "pending",
            disabled: !round.canEnter || !ask,
            onPress: () => ladder.start(side),
          },
    action1: ladder.canPress
      ? { label: "FOLD", onPress: ladder.fold }
      : {
          label: "LONG",
          pulse: !live && side === "up",
          disabled: live || round.status === "pending",
          onPress: () => setSide("up"),
        },
    action2: ladder.canPress
      ? null
      : {
          label: "SHORT",
          pulse: !live && side === "down",
          disabled: live || round.status === "pending",
          onPress: () => setSide("down"),
        },
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : title.toUpperCase(),
      right: `$${formatCollateral(round.balance)}`,
    },
    lightShow: round.status === "settling" || ladder.canPress,
  });

  // ── Won a rung: press on, or fold ────────────────────────────────────────
  if (ladder.canPress) {
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-up">
          Rung {ladder.height} cleared
        </div>
        <BigNumber value={`$${ladder.nextStake.toFixed(2)}`} tone="up" />
        <div className="text-[11px] font-semibold text-text-2">
          riding on the next window
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-text-3">
          press to roll · fold to keep it
        </div>
      </ScreenRoot>
    );
  }

  // ── Ladder over ───────────────────────────────────────────────────────────
  if (ladder.finished) {
    const lost = round.status === "lost" || round.status === "void";
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {lost ? `Broke on rung ${ladder.height + 1}` : "Folded"}
        </div>
        <BigNumber
          value={lost ? `−$${ladder.atRisk.toFixed(2)}` : `$${ladder.nextStake.toFixed(2)}`}
          tone={lost ? "down" : "up"}
        />
        <div className="text-[11px] font-semibold text-text-2">
          {ladder.height} rung{ladder.height === 1 ? "" : "s"} cleared
        </div>
      </ScreenRoot>
    );
  }

  if (round.status === "settling") {
    return (
      <ScreenRoot className="items-center justify-center gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Rung {ladder.height + 1} closing
        </div>
        <BigNumber value="…" tone="brand" />
      </ScreenRoot>
    );
  }

  // ── A rung is riding ─────────────────────────────────────────────────────
  if (live && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`Rung ${ladder.height + 1} · ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <BigNumber
          value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
          tone="brand"
        />
        <ScreenRow
          label="Staked"
          value={
            round.entryCost != null
              ? `$${(Number(round.entryCost) / 1e6).toFixed(2)}`
              : "—"
          }
        />
        <ScreenRow label="In the ladder" value={`$${ladder.atRisk.toFixed(2)}`} />
        <ScreenBar
          progress={
            round.window.intervalSec
              ? 1 - round.secsLeft / round.window.intervalSec
              : 0
          }
        />
      </ScreenRoot>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader
        left={title}
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />
      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        {side === "up" ? "Up pays" : "Down pays"}
      </div>
      <BigNumber
        value={ask ? `${book.multipleAt(ask.price).toFixed(2)}x` : "—"}
        tone={side === "up" ? "up" : "down"}
      />
      <ScreenRow
        label="First rung"
        value={ask ? `$${ask.price.toFixed(2)}` : "—"}
      />
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {round.message
          ? round.message
          : !round.window
            ? "finding a window"
            : round.balance === 0n
              ? "fund your wallet"
              : lockSide
                ? "pick a side — every rung rides it"
                : "clear a rung, then press or fold"}
      </div>
    </ScreenRoot>
  );
}
