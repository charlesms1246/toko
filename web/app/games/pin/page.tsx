"use client";

/**
 * Pin — name the price and wait for the market to come to you.
 *
 * The original called a *price level* and paid for being closest. A binary has
 * no continuous outcome to be close to, but it does have one thing worth naming:
 * the price you are willing to pay. So Pin rests a bid at your called price and
 * it fills only if the book travels to meet it.
 *
 * That makes Pin the one game whose mechanic is **making** rather than taking —
 * every call adds real depth to a venue that is short of it. Playing it is
 * indistinguishable from providing liquidity.
 *
 * It runs on the **5-minute** series: a resting bid needs room for the market to
 * move, and a 60-second window rarely gives it any.
 *
 * The trade-off is honest and visible: call closer to the market and you fill
 * often for a small multiple; call far out and you win a lot, or nothing at all
 * because the price never came and the order simply expired.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import { useRound, type Side } from "@/lib/games/useRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import PriceChart from "@/components/screen/PriceChart";
import {
  CentreRule,
  CentreStat,
  Footer,
  Fx,
  GhostCount,
  Header,
  Shell,
  Splash,
  Stage,
  StageCentre,
  StageReadout,
  Tile,
  TileRow,
} from "@/components/screen/GameScreen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import * as markets from "@/lib/dreamdex/markets";

/** Called prices. Lower is further from the market and pays more. */
const CALLS = [0.4, 0.3, 0.2, 0.1, 0.05];
const SIZE = 1;
/**
 * A resting bid needs room for the market to travel, so Pin wants a window with
 * real time left rather than the shortest one going. It asks for runway instead
 * of naming a cadence — the venue has stopped rolling series before now, and a
 * game pinned to one simply stops finding a market.
 */
const PIN_RUNWAY_S = 120;

export default function PinPage() {
  const round = useRound(null, PIN_RUNWAY_S);
  const spot = useSpot(round.window?.asset ?? "BTC");
  const [callIdx, setCallIdx] = useState(1);
  const [side, setSide] = useState<Side>("up");

  const call = CALLS[callIdx];
  const settled = ["won", "lost", "void"].includes(round.status);
  const resting = round.status === "resting";
  const live = round.status === "open";

  const ask = book.best(side === "up" ? round.book.yesAsks : round.book.noAsks);
  /** How far the market still has to travel to reach the call. */
  const distance = ask ? ask.price - call : null;

  const place = (s: Side) => {
    setSide(s);
    if (!round.canEnter) return;
    // `price` is the YES price on both sides — a DOWN call is 1 − the call.
    round.rest(s, s === "up" ? call : 1 - call, SIZE);
  };

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.sell }
      : resting
        ? { label: "WAITING", disabled: true }
        : {
            label: round.status === "pending" ? "…" : "PIN IT",
            loading: round.status === "pending",
            disabled: !round.canEnter,
            onPress: () => place(side),
          },
    action1: {
      label: "LONG",
      pulse: !live && !resting && side === "up",
      disabled: live || resting || round.status === "pending",
      onPress: () => place("up"),
    },
    action2: {
      label: "SHORT",
      pulse: !live && !resting && side === "down",
      disabled: live || resting || round.status === "pending",
      onPress: () => place("down"),
    },
    knob: {
      min: 0,
      max: CALLS.length - 1,
      step: 1,
      value: callIdx,
      label: "CALL",
      format: (v) => `${(1 / CALLS[v]).toFixed(1)}x`,
      onChange: (v) => !live && !resting && setCallIdx(v),
    },
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : "PIN",
      right: `$${formatCollateral(round.balance)}`,
    },
    lightShow: round.status === "settling" || settled,
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
      eyebrow={`Pin · ${round.window?.asset ?? "—"}`}
      value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
      rightLabel={round.window ? "Ends in" : "Balance"}
      rightValue={
        round.window
          ? `${round.secsLeft.toFixed(0)}s`
          : `$${formatCollateral(round.balance)}`
      }
    />
  );

  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? Number(round.payout - round.entryCost) / 1e6
        : null;
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <Splash
            won={won}
            value={
              net == null
                ? "—"
                : `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}`
            }
          />
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {round.status === "void" ? "Voided" : won ? "Pinned it" : "Missed"}
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
            Window closed
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── The bid is on the book, waiting ──────────────────────────────────────
  if (resting && round.window) {
    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile label="Resting at" value={call.toFixed(2)} tone="brand" />
          <Tile label="Market" value={ask ? ask.price.toFixed(3) : "—"} />
          <Tile
            label="Must fall"
            value={distance != null && distance > 0 ? distance.toFixed(3) : "—"}
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            On the book · fills if the market comes
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Filled — the call was hit ────────────────────────────────────────────
  if (live && round.window) {
    return (
      <Shell>
        {header}
        <TileRow cols={2}>
          <Tile
            label="Paid"
            value={
              round.entryCost != null
                ? `$${(Number(round.entryCost) / 1e6).toFixed(2)}`
                : "—"
            }
          />
          <Tile
            label="Pays"
            value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
            tone="up"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
          <StageReadout label="Call hit">
            <span className="tnum text-[30px] font-extrabold leading-none text-up">
              {call.toFixed(2)}
            </span>
          </StageReadout>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Filled at your price · riding to the buzzer
          </div>
        </Footer>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <Stage>
        {chart}
        <StageCentre>
          <CentreStat label="Your call pays" value={`${(1 / call).toFixed(1)}x`} />
          <CentreRule />
          <CentreStat
            label={side === "up" ? "Up now" : "Down now"}
            value={ask ? ask.price.toFixed(3) : "—"}
            tone={side === "up" ? "up" : "down"}
          />
        </StageCentre>
      </Stage>
      <Footer>
        <div className="flex items-center gap-1">
          {CALLS.map((c, i) => (
            <span
              key={c}
              className={`tnum flex-1 border px-1 py-0.5 text-center text-[11px] font-extrabold ${
                i === callIdx
                  ? "border-brand-500 bg-brand-500 text-black"
                  : "border-white/10 text-text-3"
              }`}
            >
              {c.toFixed(2)}
            </span>
          ))}
        </div>
        <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          {round.message
            ? round.message
            : !round.window
              ? "finding a window"
              : `${side === "up" ? "long" : "short"} · press pin it`}
        </div>
      </Footer>
    </Shell>
  );
}
