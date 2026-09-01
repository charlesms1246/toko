"use client";

/**
 * The Round — one live Event Contract window is one round.
 *
 * It plays whatever the shortest live series is. The venue stopped rolling 1m
 * windows, and then 5m ones, and a game pinned to a cadence stops finding a
 * market when that happens.
 *
 * LONG buys Up, SHORT buys Down, and the knob is your **limit price**, shown as
 * the multiple it implies: a binary pays 1 per contract, so a price of 0.33 is
 * 3x. Asking for a bigger multiple means bidding lower, which fills only when
 * the market agrees that side is an underdog. `MKT` takes whatever the book is
 * offering.
 *
 * Nothing here is modelled. The countdown is the window's real expiry, the
 * prices are the resting book, and the result comes from the oracle.
 *
 * Lucky and Moonshot are the same instrument at different ends of the price
 * range, so they are the same screen with a different ladder — Moonshot's rungs
 * only fill when a side is a heavy underdog, which is what makes it a moonshot.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import PriceChart from "@/components/screen/PriceChart";
import {
  Fx,
  Footer,
  GhostCount,
  Header,
  Shell,
  Splash,
  Stage,
  StageReadout,
  Tile,
  TileRow,
} from "@/components/screen/GameScreen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import { useRound, type Side } from "@/lib/games/useRound";
import * as book from "@/lib/dreamdex/book";
import * as markets from "@/lib/dreamdex/markets";
import { formatCollateral } from "@/lib/dreamdex/wallet";

/** A knob detent: `price` null means MARKET — cross whatever is resting. */
export interface Rung {
  label: string;
  price: number | null;
}

const SIZES = [1, 2, 5, 10, 25];
/** Wide enough to survive the ~3s round trip; see TESTNET_FACTS. */
const SLIPPAGE = 0.02;

export default function RoundConsole({
  title,
  ladder,
}: {
  title: string;
  ladder: Rung[];
}) {
  const LADDER = ladder;
  const round = useRound();
  const spot = useSpot(round.window?.asset ?? "BTC");
  const [rung, setRung] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [side, setSide] = useState<Side>("up");

  const size = SIZES[sizeIdx];
  const target = LADDER[rung];
  const settled = ["won", "lost", "void"].includes(round.status);
  const live = round.status === "open";

  const ask = book.best(
    side === "up" ? round.book.yesAsks : round.book.noAsks,
  );
  const marketMultiple = ask ? book.multipleAt(ask.price) : null;

  /** The YES-terms limit this press would send. */
  const limitFor = (s: Side): number => {
    const offer = book.best(s === "up" ? round.book.yesAsks : round.book.noAsks);
    if (target.price == null) {
      // MARKET: cross the offer, converting for the down side.
      if (!offer) return s === "up" ? 0.99 : 0.01;
      return s === "up" ? offer.price + SLIPPAGE : 1 - offer.price - SLIPPAGE;
    }
    return s === "up" ? target.price : 1 - target.price;
  };

  const fire = (s: Side) => {
    setSide(s);
    if (!round.canEnter) return;
    round.buy(s, limitFor(s), size);
  };

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.sell }
      : {
          label: round.status === "pending" ? "…" : "PLAY",
          loading: round.status === "pending",
          disabled: !round.canEnter,
          onPress: () => fire(side),
        },
    action1: {
      label: "LONG",
      pulse: !live && side === "up",
      disabled: live || round.status === "pending",
      onPress: () => fire("up"),
    },
    action2: {
      label: "SHORT",
      pulse: !live && side === "down",
      disabled: live || round.status === "pending",
      onPress: () => fire("down"),
    },
    knob: {
      min: 0,
      max: LADDER.length - 1,
      step: 1,
      value: rung,
      label: "PAYOUT",
      format: (v) => LADDER[v].label,
      onChange: (v) => !live && setRung(v),
    },
    numberWheel: {
      min: 0,
      max: SIZES.length - 1,
      step: 1,
      value: sizeIdx,
      label: "SIZE",
      format: (v) => `${SIZES[v]}`,
      onChange: (v) => !live && setSizeIdx(v),
    },
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : title.toUpperCase(),
      right: `$${formatCollateral(round.balance)}`,
    },
    lightShow: round.status === "settling" || settled,
  });

  // The three live states are the *same screen*. The reference never swaps to a
  // data readout when you hold a position — the market keeps drawing, and the
  // clock becomes wallpaper behind it. Only the footer and the centre change.
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
      eyebrow={`${title} · ${round.window?.asset ?? "—"}`}
      value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
      rightLabel={round.window ? "Ends in" : "Balance"}
      rightValue={
        round.window
          ? `${round.secsLeft.toFixed(0)}s`
          : `$${formatCollateral(round.balance)}`
      }
    />
  );

  // ── Settled ──────────────────────────────────────────────────────────────
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
            {round.status === "void"
              ? "Voided"
              : round.cashedOut
                ? "Cashed out"
                : won
                  ? "You won"
                  : "Rekt"}
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            {round.payout != null
              ? `$${formatCollateral(round.payout)} back`
              : "—"}
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Settling ─────────────────────────────────────────────────────────────
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
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-brand-500">
            waiting on the oracle
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Live position ────────────────────────────────────────────────────────
  if (live && round.window) {
    const bid = book.best(
      round.side === "up" ? round.book.yesBids : round.book.noBids,
    );
    const markNow = bid ? (Number(round.held) / 1e6) * bid.price : null;
    const cost = round.entryCost != null ? Number(round.entryCost) / 1e6 : null;
    const pnl = markNow != null && cost != null ? markNow - cost : null;

    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile label="Contracts" value={(Number(round.held) / 1e6).toFixed(2)} />
          <Tile label="Paid" value={cost != null ? `$${cost.toFixed(2)}` : "—"} />
          <Tile
            label="To win"
            value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
            tone="brand"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
          <StageReadout label={pnl != null && pnl >= 0 ? "Ahead" : "Behind"}>
            <span
              className={`tnum text-[30px] font-extrabold leading-none ${
                pnl != null && pnl >= 0 ? "text-up" : "text-down"
              }`}
            >
              {markNow == null ? "—" : `$${markNow.toFixed(2)}`}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              bid
            </span>
          </StageReadout>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {round.side === "up" ? "Long" : "Short"} · holding to the buzzer
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            {pnl == null
              ? "—"
              : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`}
            <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              if you cash out
            </span>
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  // ── Idle ─────────────────────────────────────────────────────────────────
  // The reference's game-screen composition: a bordered header carrying the
  // live price, a tile strip, the chart running full-bleed behind everything,
  // and a footer that claims the notch band with its content held left of the
  // Play key.
  return (
    <Shell>
      <Header
        eyebrow={`${title} · ${round.window?.asset ?? "—"}`}
        value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
        rightLabel={round.window ? "Ends in" : "Balance"}
        rightValue={
          round.window
            ? `${round.secsLeft.toFixed(0)}s`
            : `$${formatCollateral(round.balance)}`
        }
      />

      <TileRow cols={3}>
        <Tile
          label="Strike"
          value={
            round.window?.strike != null
              ? `$${markets.formatStrike(round.window.strike)}`
              : "—"
          }
        />
        <Tile label="Size" value={`${size}`} />
        <Tile
          label="Side"
          value={side === "up" ? "LONG" : "SHORT"}
          tone={side === "up" ? "up" : "down"}
        />
      </TileRow>

      <Stage>
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
        <StageReadout label={side === "up" ? "Up pays" : "Down pays"}>
          <span className="tnum text-[30px] font-extrabold leading-none text-brand-500">
            {marketMultiple ? `${marketMultiple.toFixed(2)}x` : "—"}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
            live
          </span>
        </StageReadout>
      </Stage>

      <Footer>
        <div className="flex items-center gap-1">
          {LADDER.map((rungOption, i) => (
            <span
              key={rungOption.label}
              className={`tnum flex-1 border px-1 py-0.5 text-center text-[11px] font-extrabold ${
                i === rung
                  ? "border-brand-500 bg-brand-500 text-black"
                  : "border-white/10 text-text-3"
              }`}
            >
              {rungOption.label}
            </span>
          ))}
        </div>
        <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          {round.message
            ? round.message
            : !round.window
              ? "finding a window"
              : round.balance === 0n
                ? "fund your wallet"
                : round.secsLeft <= 6
                  ? "window closing"
                  : `${side === "up" ? "long" : "short"} · press play`}
        </div>
        <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
          {ask ? `$${(ask.price * size).toFixed(2)}` : "—"}
          <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
            to play
          </span>
        </div>
      </Footer>
    </Shell>
  );
}
