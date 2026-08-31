"use client";

/**
 * Rush — take the deal, or push for a better one.
 *
 * The banker is the order book. Once you hold a position, the resting bid on
 * your side *is* the deal: sell now and take it, or push and let the window
 * settle for the full 1.00 a winning contract pays.
 *
 * Nothing is offered that the market is not actually offering — the deal is a
 * real bid with real size behind it, and it moves as the window runs down. Push
 * too far and there may be no bid left to take, which is the same liquidity
 * cliff the entry cutoff is built around.
 */

import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { useMinuteRound } from "@/lib/games/useMinuteRound";
import * as book from "@/lib/dreamdex/book";
import { formatCollateral } from "@/lib/dreamdex/wallet";

const SIZE = 1;
const SLIPPAGE = 0.02;

export default function RushPage() {
  const round = useMinuteRound();
  const settled = ["won", "lost", "void"].includes(round.status);
  const live = round.status === "open";

  const upAsk = book.best(round.book.yesAsks);
  const contracts = Number(round.held) / 1e6;

  /** The banker's standing offer: the live bid on the side held. */
  const deal = live
    ? book.best(round.side === "up" ? round.book.yesBids : round.book.noBids)
    : null;
  const dealValue = deal ? deal.price * contracts : null;
  const cost = round.entryCost != null ? Number(round.entryCost) / 1e6 : null;

  useProgramConsole({
    main: live
      ? {
          label: deal ? "TAKE THE DEAL" : "NO DEAL",
          pulse: !!deal,
          disabled: !deal,
          onPress: round.sell,
        }
      : {
          label: round.status === "pending" ? "…" : "ANTE UP",
          loading: round.status === "pending",
          disabled: !round.canEnter || !upAsk,
          onPress: () =>
            upAsk && round.buy("up", upAsk.price + SLIPPAGE, SIZE),
        },
    // No PUSH key: pushing *is* declining the deal, so a button for it would
    // be a control that does nothing. The console offers the deal; ignoring it
    // is the push.
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : "RUSH",
      right: `$${formatCollateral(round.balance)}`,
    },
    lightShow: round.status === "settling" || settled,
  });

  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && cost != null
        ? Number(round.payout) / 1e6 - cost
        : null;
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {round.status === "void"
            ? "Voided"
            : round.cashedOut
              ? "Took the deal"
              : won
                ? "Pushed and won"
                : "Busted"}
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
          Pushed to the buzzer
        </div>
        <BigNumber value="…" tone="brand" />
      </ScreenRoot>
    );
  }

  if (live && round.window) {
    const ahead = dealValue != null && cost != null && dealValue >= cost;
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          The deal
        </div>
        <BigNumber
          value={dealValue == null ? "no bid" : `$${dealValue.toFixed(2)}`}
          tone={ahead ? "up" : "down"}
        />
        <ScreenRow label="Paid" value={cost != null ? `$${cost.toFixed(2)}` : "—"} />
        <ScreenRow
          label="Push pays"
          value={`$${contracts.toFixed(2)}`}
          tone="brand"
        />
        <ScreenBar
          progress={
            round.window.intervalSec
              ? 1 - round.secsLeft / round.window.intervalSec
              : 0
          }
        />
        <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
          take the deal, or hold and let it ride
        </div>
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader
        left="Rush"
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />
      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Up pays
      </div>
      <BigNumber
        value={upAsk ? `${book.multipleAt(upAsk.price).toFixed(2)}x` : "—"}
        tone="brand"
      />
      <ScreenRow
        label="Ante"
        value={upAsk ? `$${(upAsk.price * SIZE).toFixed(2)}` : "—"}
      />
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {round.message
          ? round.message
          : !round.window
            ? "finding a window"
            : round.balance === 0n
              ? "fund your wallet"
              : "ante up, then take or push"}
      </div>
    </ScreenRoot>
  );
}
