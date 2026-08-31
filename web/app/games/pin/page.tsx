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
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { useRound, type Side } from "@/lib/games/useRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";

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

  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? Number(round.payout - round.entryCost) / 1e6
        : null;
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {round.status === "void" ? "Voided" : won ? "Pinned it" : "Missed"}
        </div>
        <BigNumber
          value={net == null ? "—" : `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}`}
          tone={won ? "up" : "down"}
        />
      </ScreenRoot>
    );
  }

  if (round.status === "settling") {
    return (
      <ScreenRoot className="items-center justify-center gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Window closed
        </div>
        <BigNumber value="…" tone="brand" />
      </ScreenRoot>
    );
  }

  // ── The bid is on the book, waiting ──────────────────────────────────────
  if (resting && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Resting at
        </div>
        <BigNumber value={call.toFixed(2)} tone="brand" />
        <ScreenRow
          label="Market"
          value={ask ? ask.price.toFixed(3) : "—"}
        />
        <ScreenRow
          label="Needs to fall"
          value={distance != null && distance > 0 ? distance.toFixed(3) : "—"}
        />
        <ScreenBar
          progress={
            round.window.intervalSec
              ? 1 - round.secsLeft / round.window.intervalSec
              : 0
          }
        />
        <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
          on the book · fills if the market comes
        </div>
      </ScreenRoot>
    );
  }

  // ── Filled — the call was hit ────────────────────────────────────────────
  if (live && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-up">
          Call hit
        </div>
        <BigNumber
          value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
          tone="up"
        />
        <ScreenRow
          label="Paid"
          value={
            round.entryCost != null
              ? `$${(Number(round.entryCost) / 1e6).toFixed(2)}`
              : "—"
          }
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

  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader
        left="Pin"
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />
      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Your call pays
      </div>
      <BigNumber value={`${(1 / call).toFixed(1)}x`} tone="brand" />

      <div className="flex items-center justify-center gap-1.5">
        {CALLS.map((c, i) => (
          <span
            key={c}
            className={`rounded-md px-2 py-1 text-[11px] font-black tabular-nums ${
              i === callIdx ? "bg-brand-500 text-black" : "text-text-3"
            }`}
          >
            {c.toFixed(2)}
          </span>
        ))}
      </div>

      <ScreenRow
        label={side === "up" ? "Up now" : "Down now"}
        value={ask ? ask.price.toFixed(3) : "—"}
      />
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {round.message
          ? round.message
          : !round.window
            ? "finding a window"
            : round.balance === 0n
              ? "fund your wallet"
              : "name a price · the market must come to you"}
      </div>
    </ScreenRoot>
  );
}
