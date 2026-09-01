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
import { useRound } from "@/lib/games/useRound";
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

const SIZE = 1;
const SLIPPAGE = 0.02;

export default function RushPage() {
  const round = useRound();
  const spot = useSpot(round.window?.asset ?? "BTC");
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
      eyebrow={`Rush · ${round.window?.asset ?? "—"}`}
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
      round.payout != null && cost != null
        ? Number(round.payout) / 1e6 - cost
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
                ? "Took the deal"
                : won
                  ? "Held and won"
                  : "Busted"}
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
            Held to the buzzer
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-brand-500">
            waiting on the oracle
          </div>
        </Footer>
      </Shell>
    );
  }

  if (live && round.window) {
    const ahead = dealValue != null && cost != null && dealValue >= cost;
    return (
      <Shell>
        {header}
        <TileRow cols={2}>
          <Tile label="Paid" value={cost != null ? `$${cost.toFixed(2)}` : "—"} />
          <Tile label="Hold pays" value={`$${contracts.toFixed(2)}`} tone="brand" />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
          <StageReadout label="The deal">
            <span
              className={`tnum text-[30px] font-extrabold leading-none ${
                ahead ? "text-up" : "text-down"
              }`}
            >
              {dealValue == null ? "no bid" : `$${dealValue.toFixed(2)}`}
            </span>
          </StageReadout>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Take the deal, or hold it to the buzzer
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
          <CentreStat
            label="Up pays"
            value={upAsk ? `${book.multipleAt(upAsk.price).toFixed(2)}x` : "—"}
          />
          <CentreRule />
          <CentreStat
            label="Ante"
            value={upAsk ? `$${(upAsk.price * SIZE).toFixed(2)}` : "—"}
            tone="up"
          />
        </StageCentre>
      </Stage>
      <Footer>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          {round.message ?? (round.window ? "Ante up to take a hand" : "finding a window")}
        </div>
      </Footer>
    </Shell>
  );
}
