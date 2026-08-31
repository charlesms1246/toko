"use client";

/**
 * Snipe — the wall drifts in. Press when it is close.
 *
 * The wall is real: as a window runs down, the underdog side's offer slides
 * toward zero and its payout climbs. Waiting is worth more, and waiting costs
 * you — inside the last couple of seconds the maker withdraws its quotes
 * entirely and there is nothing left to take. That cutoff was measured, not
 * invented (TESTNET_FACTS §Q3), and the console derives it from live depth
 * rather than a hardcoded clock.
 *
 * So the skill is nerve, and the risk is real: hold out for a bigger multiple
 * and you may find the book empty.
 */

import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { useMinuteRound, ENTRY_CUTOFF_SECONDS } from "@/lib/games/useMinuteRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";

const SIZE = 1;
const SLIPPAGE = 0.02;

export default function SnipePage() {
  const round = useMinuteRound();
  const settled = ["won", "lost", "void"].includes(round.status);
  const live = round.status === "open";

  // The wall is whichever side is currently the underdog — the cheaper offer,
  // and so the bigger payout.
  const upAsk = book.best(round.book.yesAsks);
  const downAsk = book.best(round.book.noAsks);
  const wall =
    upAsk && downAsk
      ? upAsk.price <= downAsk.price
        ? { side: "up" as const, ask: upAsk }
        : { side: "down" as const, ask: downAsk }
      : upAsk
        ? { side: "up" as const, ask: upAsk }
        : downAsk
          ? { side: "down" as const, ask: downAsk }
          : null;

  const multiple = wall ? book.multipleAt(wall.ask.price) : null;
  const closing = round.secsLeft <= ENTRY_CUTOFF_SECONDS;

  const take = () => {
    if (!wall || !round.canEnter) return;
    const limit =
      wall.side === "up"
        ? wall.ask.price + SLIPPAGE
        : 1 - wall.ask.price - SLIPPAGE;
    round.buy(wall.side, limit, SIZE);
  };

  useProgramConsole({
    main: live
      ? { label: "CASH OUT", pulse: true, onPress: round.sell }
      : {
          label: round.status === "pending" ? "…" : "TAKE",
          loading: round.status === "pending",
          disabled: !round.canEnter || !wall,
          pulse: !!wall && !closing,
          onPress: take,
        },
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : "SNIPE",
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
          {round.status === "void"
            ? "Voided"
            : round.cashedOut
              ? "Cashed out"
              : won
                ? "Sniped"
                : "Missed"}
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

  if (live && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <BigNumber
          value={`$${(Number(round.held) / 1e6).toFixed(2)}`}
          tone="brand"
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
        left="Snipe"
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />

      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        {wall ? `${wall.side === "up" ? "Up" : "Down"} pays` : "waiting for a quote"}
      </div>
      <BigNumber
        value={multiple ? `${multiple.toFixed(2)}x` : "—"}
        tone={closing ? "down" : "brand"}
      />

      {/* The wall: how much of the window is left before the quotes vanish. */}
      <ScreenBar
        progress={
          round.window && round.window.intervalSec
            ? 1 - round.secsLeft / round.window.intervalSec
            : 0
        }
      />

      <ScreenRow
        label="Costs"
        value={wall ? `$${(wall.ask.price * SIZE).toFixed(2)}` : "—"}
      />

      <div
        className={`text-center text-[10px] font-semibold uppercase tracking-widest ${
          closing ? "text-down" : "text-text-3"
        }`}
      >
        {round.message
          ? round.message
          : !round.window
            ? "finding a window"
            : round.balance === 0n
              ? "fund your wallet"
              : closing
                ? "too late — quotes pulled"
                : "wait for the payout · press take"}
      </div>
    </ScreenRoot>
  );
}
