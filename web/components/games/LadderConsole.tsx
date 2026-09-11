"use client";

/**
 * The roll ladder on the console — Press.
 *
 * Each rung is a real Round staked with the previous rung's payout. Win
 * and the console offers PRESS or FOLD; lose and the ladder ends there. You
 * pick a side afresh on every rung.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import { useRollLadder } from "@/lib/games/useRollLadder";
import type { Side } from "@/lib/games/useRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { fromRaw } from "@/lib/dreamdex/config";
import PriceChart from "@/components/screen/PriceChart";
import {
  Footer,
  Fx,
  GhostCount,
  Header,
  Payoff,
  Shell,
  Splash,
  Stage,
  Tile,
  TileRow,
} from "@/components/screen/GameScreen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import * as markets from "@/lib/dreamdex/markets";

export default function LadderConsole({ title }: { title: string }) {
  const ladder = useRollLadder();
  const spot = useSpot(ladder.round.window?.asset ?? "BTC");
  const { round } = ladder;
  const [side, setSide] = useState<Side>("up");

  const live = round.status === "open";
  const ask = book.best(side === "up" ? round.book.yesAsks : round.book.noAsks);

  useProgramConsole({
    main: ladder.canPress
      ? { label: "PRESS", pulse: true, onPress: ladder.press }
      : ladder.finished
        ? { label: "NEW LADDER", pulse: true, onPress: ladder.clear }
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
    lightShow: round.status === "settling" || ladder.canPress,
  });

  const chart = (
    <>
      <PriceChart
        bare
        asset={round.window?.asset ?? "BTC"}
        entry={
          round.window?.strike != null
            ? markets.strikePrice(round.window.strike)
            : null
        }
      />
      <Fx />
    </>
  );

  const header = (
    <Header
      eyebrow={`${title} · rung ${ladder.height + 1}`}
      value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
      rightLabel="Available"
      rightValue={`$${formatCollateral(round.balance)}`}
      rightNote={
        round.window ? `Ends in ${round.secsLeft.toFixed(0)}s` : undefined
      }
      badge={ladder.height > 0 ? `Rung ${ladder.height}` : undefined}
    />
  );

  // ── Won a rung: press on, or fold ────────────────────────────────────────
  if (ladder.canPress) {
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <Splash won value={`$${ladder.nextStake.toFixed(2)}`} />
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-up">
            Rung {ladder.height} cleared
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            press to roll · fold to keep it
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Ladder over ───────────────────────────────────────────────────────────
  if (ladder.finished) {
    const lost = round.status === "lost" || round.status === "void";
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <Splash
            won={!lost}
            value={
              lost
                ? `−$${ladder.atRisk.toFixed(2)}`
                : `$${ladder.nextStake.toFixed(2)}`
            }
          />
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {lost ? `Broke on rung ${ladder.height + 1}` : "Folded"}
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            {ladder.height} rung{ladder.height === 1 ? "" : "s"} cleared
          </div>
        </Footer>
      </Shell>
    );
  }

  if (round.status === "settling") {
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <GhostCount>0</GhostCount>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Rung {ladder.height + 1} closing
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── A rung is riding ─────────────────────────────────────────────────────
  if (live && round.window) {
    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile
            label="Staked"
            value={
              round.entryCost != null
                ? `$${fromRaw(round.entryCost).toFixed(2)}`
                : "—"
            }
          />
          <Tile label="At risk" value={`$${ladder.atRisk.toFixed(2)}`} />
          <Tile
            label="Pays"
            value={`$${fromRaw(round.held).toFixed(2)}`}
            tone="brand"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {round.side === "up" ? "Long" : "Short"} · rung riding
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {header}
      <Stage>{chart}</Stage>
      <Footer>
        <Payoff
          label={
            ask
              ? `${side === "up" ? "Long" : "Short"} · $${ask.price.toFixed(2)} → $1.00 a rung`
              : "No offer on this side"
          }
          value={ask ? `${book.multipleAt(ask.price).toFixed(2)}x` : "—"}
          tone={side === "up" ? "up" : "down"}
        />
        <div className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          {round.message
            ? round.message
            : !round.window
              ? "finding a window"
              : `${side === "up" ? "long" : "short"} · press start`}
        </div>
      </Footer>
    </Shell>
  );
}
