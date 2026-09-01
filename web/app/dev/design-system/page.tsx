"use client";

/**
 * The in-console instrument catalogue, in the reference build's architecture:
 * a north-star statement, a mocked game screen, then every instrument as a
 * labelled tile with its category.
 *
 * The reference lists 41. This lists what we have actually built, because a
 * catalogue that shows instruments the app cannot draw is a brochure, not a
 * reference. Each tile below renders the real component against real data.
 */

import { useState } from "react";
import PriceChart from "@/components/screen/PriceChart";
import {
  CentreRule,
  CentreStat,
  Footer,
  Fx,
  GhostCount,
  Header,
  Notice,
  NOTICES,
  Overlay,
  Readout,
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

type Kind = "chart" | "layout" | "readout" | "status";

interface Piece {
  name: string;
  kind: Kind;
  note: string;
  render: React.ReactNode;
}

/** A framed swatch, so every instrument is shown at a comparable size. */
function Frame({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div
      // A flex column, so a `Stage` child (which is `min-h-0 flex-1`) actually
      // gets height instead of collapsing to nothing.
      className={`relative flex flex-col overflow-hidden border border-[var(--color-line)] bg-black ${
        tall ? "h-[240px]" : "h-[132px]"
      }`}
      style={{ ["--screen-rim" as string]: "14px", ["--screen-notch" as string]: "34px" }}
    >
      {children}
    </div>
  );
}

export default function DesignSystemPage() {
  const spot = useSpot("BTC");
  const [filter, setFilter] = useState<Kind | "all">("all");

  const pieces: Piece[] = [
    {
      name: "Price chart",
      kind: "chart",
      note: "Oracle ticks, the window's opening price as ENTRY, a glowing live mark.",
      render: (
        <PriceChart asset="BTC" entry={spot > 0 ? spot * 0.9995 : null} className="h-full" />
      ),
    },
    {
      name: "Price chart · bare",
      kind: "chart",
      note: "The same instrument as a full-bleed stage, with no frame of its own.",
      render: (
        <>
          <PriceChart bare asset="BTC" entry={spot > 0 ? spot * 1.0004 : null} />
          <Fx />
        </>
      ),
    },
    {
      name: "Header",
      kind: "layout",
      note: "Eyebrow, one loud number, a right-hand readout. Every game opens with it.",
      render: (
        <Header
          eyebrow="Lucky · BTC"
          value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
          rightLabel="Ends in"
          rightValue="41s"
        />
      ),
    },
    {
      name: "Tile row",
      kind: "layout",
      note: "Two to four readouts under the header. The strip states the position.",
      render: (
        <TileRow cols={3}>
          <Tile label="Payout" value="2.79x" tone="brand" />
          <Tile label="Size" value="10" />
          <Tile label="Side" value="LONG" tone="up" />
        </TileRow>
      ),
    },
    {
      name: "Ghost count",
      kind: "status",
      note: "The countdown at 15% opacity behind the chart. A live position never leaves the chart.",
      render: (
        <Stage>
          <PriceChart bare asset="BTC" />
          <GhostCount>18</GhostCount>
        </Stage>
      ),
    },
    {
      name: "Stage readout",
      kind: "readout",
      note: "Floated top-right over the chart, for the number that is changing.",
      render: (
        <Stage>
          <PriceChart bare asset="BTC" />
          <StageReadout label="Up pays">
            <span className="tnum text-[30px] font-extrabold leading-none text-brand-500">
              2.79x
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              live
            </span>
          </StageReadout>
        </Stage>
      ),
    },
    {
      name: "Centre pair",
      kind: "readout",
      note: "The idle state: what you are calling on the left, what it costs on the right.",
      render: (
        <Stage>
          <PriceChart bare asset="BTC" />
          <StageCentre>
            <CentreStat label="Up pays" value="7.25x" />
            <CentreRule />
            <CentreStat label="Ante" value="$0.14" tone="up" />
          </StageCentre>
        </Stage>
      ),
    },
    {
      name: "Splash",
      kind: "status",
      note: "The result, thrown across the stage at settlement.",
      render: (
        <Stage>
          <PriceChart bare asset="BTC" />
          <Splash won value="+$4.20" />
        </Stage>
      ),
    },
    {
      name: "Footer",
      kind: "layout",
      note: "Claims the notch band and holds its content left of the Play key.",
      render: (
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Long · press play
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">$0.52</div>
        </Footer>
      ),
    },
    {
      name: "Readout",
      kind: "readout",
      note: "The kit's smallest unit — a caption over a tabular value.",
      render: (
        <div className="p-4">
          <Readout label="Contracts" value="10.00" />
        </div>
      ),
    },
    {
      name: "Notice",
      kind: "status",
      note: "Nothing to play. Says what is happening and that nothing was charged.",
      render: (
        <div className="flex h-full flex-col">
          <Notice {...NOTICES.noMarket} />
        </div>
      ),
    },
    {
      name: "Overlay",
      kind: "layout",
      note: "A panel over the game — how-to, results, anything modal.",
      render: (
        <Overlay title="How to play" subtitle="Lucky">
          <p className="font-mono text-[11.5px] leading-[1.6] text-text-2">
            Pick a side, pick a payout, press play.
          </p>
        </Overlay>
      ),
    },
  ];

  const shown = pieces.filter((p) => filter === "all" || p.kind === filter);
  const kinds: (Kind | "all")[] = ["all", "chart", "layout", "readout", "status"];

  return (
    <div className="min-h-full bg-black px-4 pb-16 pt-6">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-500">
        North star
      </div>
      <h1 className="mt-2 max-w-[22ch] text-3xl font-extrabold leading-tight tracking-tight text-text">
        Black canvas. Real numbers. Electric game screen.
      </h1>
      <p className="mt-3 max-w-[46ch] text-[15px] leading-snug text-text-2">
        The menu surface is glossy and calm. The in-console game screen is flat,
        sparse and high contrast — one loud number, the chart behind it, and
        nothing that isn&apos;t read off the chain.
      </p>

      {/* A whole game screen, assembled from the pieces below. */}
      <div className="mt-8 text-[11px] font-bold uppercase tracking-[0.16em] text-text-3">
        Assembled
      </div>
      <div
        className="mt-2 h-[420px] max-w-[320px] overflow-hidden border border-[var(--color-line)]"
        style={{ ["--screen-rim" as string]: "14px", ["--screen-notch" as string]: "64px" }}
      >
        <Shell>
          <Header
            eyebrow="Lucky · BTC"
            value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
            rightLabel="Ends in"
            rightValue="41s"
          />
          <TileRow cols={3}>
            <Tile label="Strike" value="$78,994" />
            <Tile label="Size" value="10" />
            <Tile label="Side" value="LONG" tone="up" />
          </TileRow>
          <Stage>
            <PriceChart bare asset="BTC" entry={spot > 0 ? spot * 0.9998 : null} />
            <Fx />
            <StageReadout label="Up pays">
              <span className="tnum text-[30px] font-extrabold leading-none text-brand-500">
                2.79x
              </span>
            </StageReadout>
          </Stage>
          <Footer>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
              Long · press play
            </div>
          </Footer>
        </Shell>
      </div>

      <div className="mt-10 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-500">
        Instruments
      </div>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-text">
        Screen kit
      </h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold capitalize ${
              filter === k
                ? "bg-brand-500 text-black"
                : "bg-white/[0.06] text-text-2"
            }`}
          >
            {k}{" "}
            <span className="opacity-60">
              {k === "all"
                ? pieces.length
                : pieces.filter((p) => p.kind === k).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <div key={p.name}>
            <Frame tall={p.kind === "chart" || p.kind === "status"}>
              {p.render}
            </Frame>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold text-text">{p.name}</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                {p.kind}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-text-2">{p.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
