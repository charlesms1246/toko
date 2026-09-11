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
 * One ladder spans the whole range, from the market price out to the deep tail
 * where a side trades at a cent or two. The far rungs only fill when the book
 * agrees that side is a heavy underdog — that is what makes them long shots,
 * and it is a turn of the knob rather than a different game.
 *
 * When a limit finds nobody, the same bid can be **rested** on the book instead
 * of dead-ending: it fills only if the market comes to it, and the escrow comes
 * back by itself when the window closes.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import PriceChart from "@/components/screen/PriceChart";
import {
  Fx,
  Footer,
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
import { useRound, type Side } from "@/lib/games/useRound";
import * as book from "@/lib/dreamdex/book";
import * as markets from "@/lib/dreamdex/markets";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { fromRaw } from "@/lib/dreamdex/config";

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
  const resting = round.status === "resting";

  const ask = book.best(side === "up" ? round.book.yesAsks : round.book.noAsks);
  const marketMultiple = ask ? book.multipleAt(ask.price) : null;

  /**
   * What the book will actually pay for the position right now — the live bid
   * on the side held, times what is held. This is the deal on offer, and it is
   * a real bid with real size behind it, not an estimate.
   */
  const bid = live
    ? book.best(round.side === "up" ? round.book.yesBids : round.book.noBids)
    : null;
  const contracts = fromRaw(round.held);
  const dealValue = bid ? bid.price * contracts : null;

  /**
   * A limit that found nobody can wait on the book instead. `MKT` has no price
   * of its own to rest at, so it is the one rung that cannot.
   */
  const canRest = round.noLiquidity && target.price != null;

  /** The YES-terms limit this press would send. */
  const limitFor = (s: Side): number => {
    const offer = book.best(
      s === "up" ? round.book.yesAsks : round.book.noAsks,
    );
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

  /** Leave the same bid on the book rather than dead-ending on an empty one. */
  const park = (s: Side) => {
    setSide(s);
    if (!round.canEnter) return;
    round.rest(s, limitFor(s), size);
  };

  useProgramConsole({
    main: live
      ? dealValue != null
        ? {
            label: `CASH OUT $${dealValue.toFixed(2)}`,
            pulse: true,
            onPress: round.sell,
          }
        : { label: "NO BID", disabled: true }
      : resting
        ? { label: "WAITING", disabled: true }
        : canRest
          ? { label: "REST IT", pulse: true, onPress: () => park(side) }
          : {
              label: round.status === "pending" ? "…" : "PLAY",
              loading: round.status === "pending",
              disabled: !round.canEnter,
              onPress: () => fire(side),
            },
    action1: {
      label: "LONG",
      pulse: !live && !resting && side === "up",
      disabled: live || resting || !round.canEnter,
      onPress: () => fire("up"),
    },
    action2: {
      label: "SHORT",
      pulse: !live && !resting && side === "down",
      disabled: live || resting || !round.canEnter,
      onPress: () => fire("down"),
    },
    knob: {
      min: 0,
      max: LADDER.length - 1,
      step: 1,
      value: rung,
      label: "PAYOUT",
      format: (v) => LADDER[v].label,
      onChange: (v) => !live && !resting && setRung(v),
    },
    numberWheel: {
      min: 0,
      max: SIZES.length - 1,
      step: 1,
      value: sizeIdx,
      label: "SIZE",
      format: (v) => `${SIZES[v]}`,
      onChange: (v) => !live && !resting && setSizeIdx(v),
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
      rightLabel="Available"
      rightValue={`$${formatCollateral(round.balance)}`}
      rightNote={
        round.window ? `Ends in ${round.secsLeft.toFixed(0)}s` : undefined
      }
    />
  );

  // ── Settled ──────────────────────────────────────────────────────────────
  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? fromRaw(round.payout - round.entryCost)
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
    const cost = round.entryCost != null ? fromRaw(round.entryCost) : null;
    const pnl = dealValue != null && cost != null ? dealValue - cost : null;

    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile label="Contracts" value={contracts.toFixed(2)} />
          <Tile
            label="Paid"
            value={cost != null ? `$${cost.toFixed(2)}` : "—"}
          />
          <Tile
            label="To win"
            value={`$${contracts.toFixed(2)}`}
            tone="brand"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
        </Stage>
        <Footer>
          <Payoff
            label={`${round.side === "up" ? "Long" : "Short"} · ${
              cost != null ? `paid $${cost.toFixed(2)} → ` : ""
            }on the book now`}
            value={dealValue == null ? "no bid" : `$${dealValue.toFixed(2)}`}
            tone={pnl != null && pnl < 0 ? "down" : "up"}
          />
          <div className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
            {pnl == null
              ? "take the deal, or hold to the buzzer"
              : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)} if you cash out · or hold to the buzzer`}
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── The bid is on the book, waiting ──────────────────────────────────────
  // Nobody was selling at the price asked, so the bid was left resting instead.
  // It fills only if the market comes to it; if the window closes first the
  // escrow returns and the console goes back to idle on its own.
  if (resting && round.window) {
    const distance =
      ask && target.price != null ? ask.price - target.price : null;
    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile label="Resting at" value={target.label} tone="brand" />
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
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            {round.entryCost != null
              ? `$${formatCollateral(round.entryCost)} held`
              : "—"}
            <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              back when the window closes
            </span>
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  // The reference's game-screen composition: a bordered header carrying the
  // live price, a tile strip, the chart running full-bleed behind everything,
  // and a footer that claims the notch band with its content held left of the
  // Play key.
  return (
    <Shell>
      {header}

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
      </Stage>

      <Footer>
        {/* Eight rungs on a narrow footer: they shrink to fit rather than
            pushing the far end of the ladder under the big key. */}
        <div className="flex items-center gap-0.5">
          {LADDER.map((rungOption, i) => (
            <span
              key={rungOption.label}
              className={`tnum min-w-0 flex-1 border px-0.5 py-0.5 text-center text-[10px] font-extrabold ${
                i === rung
                  ? "border-brand-500 bg-brand-500 text-black"
                  : "border-white/10 text-text-3"
              }`}
            >
              {rungOption.label}
            </span>
          ))}
        </div>
        <div className="mt-2">
          <Payoff
            /* No side prefix: the SIDE tile above already says which way. */
            label={
              ask
                ? `$${(ask.price * size).toFixed(2)} → $${size.toFixed(2)}`
                : "No offer on this side"
            }
            value={marketMultiple ? `${marketMultiple.toFixed(2)}x` : "—"}
          />
        </div>
        <div className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          {canRest
            ? `${round.message} · rest it instead?`
            : round.message
              ? round.message
              : !round.window
                ? "finding a window"
                : round.balance === 0n
                  ? "fund your wallet"
                  : round.secsLeft <= 6
                    ? "window closing"
                    : !round.canEnter
                      ? "nobody quoting"
                      : `${side === "up" ? "long" : "short"} · press play`}
        </div>
      </Footer>
    </Shell>
  );
}
