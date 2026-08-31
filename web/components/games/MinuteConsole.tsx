"use client";

/**
 * The Minute — one live 1-minute Event Contract window is one round.
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
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import CoinIcon from "@/components/games/CoinIcon";
import { useMinuteRound, type Side } from "@/lib/games/useMinuteRound";
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

export default function MinuteConsole({
  title,
  ladder,
}: {
  title: string;
  ladder: Rung[];
}) {
  const LADDER = ladder;
  const round = useMinuteRound();
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

  // ── Settled ──────────────────────────────────────────────────────────────
  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? Number(round.payout - round.entryCost) / 1e6
        : null;
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {round.status === "void"
            ? "Voided"
            : round.cashedOut
              ? "Cashed out"
              : won
                ? "You won"
                : "Rekt"}
        </div>
        <BigNumber
          value={net == null ? "—" : `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}`}
          tone={won ? "up" : "down"}
        />
        <div className="text-[11px] font-semibold text-text-2">
          {round.side === "up" ? "Up" : "Down"} ·{" "}
          {round.payout != null ? `${formatCollateral(round.payout)} back` : ""}
        </div>
      </ScreenRoot>
    );
  }

  // ── Settling ─────────────────────────────────────────────────────────────
  if (round.status === "settling") {
    return (
      <ScreenRoot className="items-center justify-center gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Window closed
        </div>
        <BigNumber value="…" tone="brand" />
        <div className="text-[11px] font-semibold text-text-2">
          waiting on the oracle
        </div>
      </ScreenRoot>
    );
  }

  // ── Live position ────────────────────────────────────────────────────────
  if (live && round.window) {
    const bid = book.best(
      round.side === "up" ? round.book.yesBids : round.book.noBids,
    );
    const markNow = bid ? Number(round.held) / 1e6 * bid.price : null;
    const cost = round.entryCost != null ? Number(round.entryCost) / 1e6 : null;
    const pnl = markNow != null && cost != null ? markNow - cost : null;

    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <BigNumber
          value={markNow == null ? "—" : `$${markNow.toFixed(2)}`}
          tone={pnl != null && pnl >= 0 ? "up" : "down"}
        />
        <ScreenRow
          label="Contracts"
          value={(Number(round.held) / 1e6).toFixed(2)}
        />
        <ScreenRow label="Paid" value={cost != null ? `$${cost.toFixed(2)}` : "—"} />
        <ScreenRow
          label="To win"
          value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
          tone="brand"
        />
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
    <ScreenRoot className="gap-1.5">
      <ScreenHeader
        left={title}
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />

      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-sm font-black tracking-tight text-text">
          {round.window && <CoinIcon asset={round.window.asset} />}
          {round.window?.asset ?? "…"}
        </span>
        <span className="text-sm font-bold tabular-nums text-text-2">
          {round.window?.strike != null
            ? `$${markets.formatStrike(round.window.strike)}`
            : "—"}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {LADDER.map((rungOption, i) => (
          <span
            key={rungOption.label}
            className={`rounded-md px-2 py-1 text-[11px] font-black tabular-nums ${
              i === rung ? "bg-brand-500 text-black" : "text-text-3"
            }`}
          >
            {rungOption.label}
          </span>
        ))}
      </div>

      <ScreenRow
        label={side === "up" ? "Up pays" : "Down pays"}
        value={marketMultiple ? `${marketMultiple.toFixed(2)}x` : "—"}
        tone={side === "up" ? "up" : "down"}
      />
      <ScreenRow
        label="Size"
        value={`${size} · $${ask ? (ask.price * size).toFixed(2) : "—"}`}
      />

      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {round.message
          ? round.message
          : !round.window
            ? "finding a window"
            : round.balance === 0n
              ? "fund your wallet"
              : round.secsLeft <= 6
                ? "window closing — next one shortly"
                : `${side === "up" ? "long" : "short"} · press play`}
      </div>
    </ScreenRoot>
  );
}
