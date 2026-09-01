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
import { useRound, ENTRY_CUTOFF_SECONDS } from "@/lib/games/useRound";
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
  Tile,
  TileRow,
} from "@/components/screen/GameScreen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import * as markets from "@/lib/dreamdex/markets";

const SIZE = 1;
const SLIPPAGE = 0.02;

export default function SnipePage() {
  const round = useRound();
  const spot = useSpot(round.window?.asset ?? "BTC");
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
      eyebrow={`Snipe · ${round.window?.asset ?? "—"}`}
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
            {round.status === "void"
              ? "Voided"
              : round.cashedOut
                ? "Cashed out"
                : won
                  ? "Sniped"
                  : "Missed"}
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
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-brand-500">
            waiting on the oracle
          </div>
        </Footer>
      </Shell>
    );
  }

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
            tone="brand"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Taken · riding to the buzzer
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
            label={wall ? `${wall.side === "up" ? "Up" : "Down"} pays` : "No quote"}
            value={multiple ? `${multiple.toFixed(2)}x` : "—"}
            tone={closing ? "down" : "brand"}
          />
          <CentreRule />
          <CentreStat
            label="Costs"
            value={wall ? `$${(wall.ask.price * SIZE).toFixed(2)}` : "—"}
            tone="up"
          />
        </StageCentre>
      </Stage>
      <Footer>
        <div
          className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
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
      </Footer>
    </Shell>
  );
}
