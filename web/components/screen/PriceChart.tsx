"use client";

/**
 * The price chart — the instrument every game screen was missing.
 *
 * A live line of the oracle's own ticks, the window's opening price drawn
 * across it as the level you are being measured against, and a glowing mark on
 * the last point. Nothing here is drawn from a model: the points are
 * `lib/api/prices`' real feed and the entry line is the market's `strike`.
 *
 * It fills whatever box it is given, because on this console the chart *is* the
 * screen — everything else is a caption around it.
 */

import { useMemo } from "react";
import { usePriceHistory } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";

const UP = "#34d399";
const DOWN = "#ff5a4d";

export default function PriceChart({
  asset,
  entry,
  side = null,
  openedAt = null,
  next = null,
  className = "",
  bare = false,
}: {
  asset: string;
  /** The window's opening price — the level the settlement compares against. */
  entry?: number | null;
  /**
   * The side actually held, when there is a position.
   *
   * Without it the chart drew a bare line: real prices, but nothing about the
   * play. Worse, the tint meant "price rose", so a winning DOWN position was
   * painted in the losing colour.
   */
  side?: "up" | "down" | null;
  /** When the position opened, ms — marks the moment on the line. */
  openedAt?: number | null;
  /**
   * The window after this one.
   *
   * `strike: null` is the normal state for a freshly published window: the venue
   * stamps it at roll time. The band then shows a countdown and no level, which
   * is the honest version of the reference's forward box — that one names a
   * price and a multiple before either exists.
   */
  next?: { secsLeft: number; strike: number | null } | null;
  className?: string;
  /** Full-bleed behind a screen: no frame, no corner ticks. */
  bare?: boolean;
}) {
  const points = usePriceHistory(asset);

  const view = useMemo(() => {
    if (points.length < 2) return null;
    const ps = points.map((p) => p.p);
    const last = ps[ps.length - 1];
    const first = ps[0];

    // The entry line has to be inside the range or it cannot be drawn, so it
    // takes part in the extent rather than being clamped onto an edge.
    let lo = Math.min(...ps);
    let hi = Math.max(...ps);
    if (entry != null && entry > 0) {
      lo = Math.min(lo, entry);
      hi = Math.max(hi, entry);
    }
    // Same reason as the entry line: a level outside the extent cannot be drawn.
    if (next?.strike != null && next.strike > 0) {
      lo = Math.min(lo, next.strike);
      hi = Math.max(hi, next.strike);
    }
    const pad = (hi - lo) * 0.14 || Math.max(1, hi * 0.0004);
    lo -= pad;
    hi += pad;

    const W = 100;
    const H = 100;
    /*
     * The right-hand slice is the future, when there is one to show. The past
     * compresses into what is left rather than the band being drawn over the
     * line — a forward region that overlaps live prices reads as if the two are
     * the same measurement.
     */
    const FWD = next ? 26 : 0;
    const PAST = W - FWD;
    const x = (i: number) => (i / (ps.length - 1)) * PAST;
    const y = (p: number) => H - ((p - lo) / (hi - lo || 1)) * H;

    const line = ps.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" ");
    const base = entry != null && entry > 0 ? entry : first;

    /*
     * Where the player got in, as an x on this line.
     *
     * Matched by timestamp rather than index: the tick history is a rolling
     * 120-point window, so an index taken when the order filled points at a
     * different moment a minute later. Null when the entry has scrolled off the
     * left edge, which is honest — the mark belongs on the line or nowhere.
     */
    let openX: number | null = null;
    if (openedAt != null && points.length) {
      const i = points.findIndex((pt) => pt.t >= openedAt);
      if (i > 0) openX = x(i);
    }

    /*
     * Winning is a side, not a direction.
     *
     * With a position, "am I up" means the price is on MY side of the strike —
     * below it is a win for DOWN. Without one there is no side to be on, so it
     * falls back to the market's own direction.
     */
    const winning =
      side === "up" ? last >= base : side === "down" ? last <= base : last >= base;

    return {
      line,
      area: `0,${H} ${line} ${PAST},${H}`,
      entryY: entry != null && entry > 0 ? y(entry) : null,
      markX: x(ps.length - 1),
      markY: y(last),
      openX,
      past: PAST,
      nextY: next?.strike != null && next.strike > 0 ? y(next.strike) : null,
      winning,
      last,
      // The last tick's direction, which is NOT the same as winning: a DOWN
      // position can be winning on a tick that rose.
      rising: ps.length > 1 ? last >= ps[ps.length - 2] : true,
      change: base > 0 ? ((last - base) / base) * 100 : 0,
    };
  }, [points, entry, side, openedAt, next]);

  const tint = view?.winning === false ? DOWN : UP;
  // The half of the range that pays, when a side is held.
  const zone = side === "up" ? UP : side === "down" ? DOWN : null;

  return (
    <div
      // Bare means it *is* the stage, so it positions itself over the whole of
      // it. Framed means it is a tile in a stack and sits in normal flow.
      className={`overflow-hidden ${
        bare
          ? "absolute inset-0"
          : "relative min-h-0 w-full border border-white/10 bg-black/40"
      } ${className}`}
    >
      {/* Corner ticks — the reference marks every instrument this way. */}
      {!bare &&
        [
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "left-0 bottom-0 border-l border-b",
          "right-0 bottom-0 border-r border-b",
        ].map((corner) => (
          <span
            key={corner}
            aria-hidden
            className={`pointer-events-none absolute h-2 w-2 border-white/35 ${corner}`}
          />
        ))}

      {view ? (
        <>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id={`fill-${asset}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tint} stopOpacity="0.28" />
                <stop offset="100%" stopColor={tint} stopOpacity="0" />
              </linearGradient>
            </defs>

            {[25, 50, 75].map((g) => (
              <line
                key={g}
                x1="0"
                y1={g}
                x2="100"
                y2={g}
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <polygon points={view.area} fill={`url(#fill-${asset})`} />

            {/* The band that pays. Above the strike for UP, below for DOWN —
                the one thing the chart never said, and the thing the player is
                actually watching for. */}
            {zone != null && view.entryY != null && (
              <rect
                x="0"
                y={side === "up" ? 0 : view.entryY}
                width={view.past}
                height={side === "up" ? view.entryY : 100 - view.entryY}
                fill={zone}
                fillOpacity="0.09"
              />
            )}

            {view.entryY != null && (
              <line
                x1="0"
                y1={view.entryY}
                x2={view.past}
                y2={view.entryY}
                stroke="#ffffff"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            <polyline
              points={view.line}
              fill="none"
              stroke={tint}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 4px ${tint}aa)` }}
            />
            {/* Where the position opened. */}
            {view.openX != null && (
              <line
                x1={view.openX}
                y1="0"
                x2={view.openX}
                y2="100"
                stroke="#ffffff"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* The window after this one.
                Dashed, and separated by the cutoff, because nothing in here has
                happened yet. A solid box would read as another measurement. */}
            {next && (
              <>
                <line
                  x1={view.past}
                  y1="0"
                  x2={view.past}
                  y2="100"
                  stroke="#ffffff"
                  strokeOpacity="0.55"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={view.past}
                  y="1"
                  width={100 - view.past}
                  height="98"
                  fill="#ffffff"
                  fillOpacity="0.03"
                  stroke="#ffffff"
                  strokeOpacity="0.28"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                {view.nextY != null && (
                  <line
                    x1={view.past}
                    y1={view.nextY}
                    x2="100"
                    y2={view.nextY}
                    stroke="#ffc016"
                    strokeOpacity="0.85"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            )}

            <circle
              cx={view.markX}
              cy={view.markY}
              r="2.4"
              fill={tint}
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 6px ${tint})` }}
            />
          </svg>

          {view.entryY != null && (
            // The tag rides with its own line, so when the strike sits near the
            // top of the range it climbs into the top-right corner — where a
            // screen's `StageReadout` also anchors. Above the threshold it
            // moves to the other rim rather than being clamped down or hidden:
            // the label has to stay on the level it names, and both of those
            // would put it somewhere the entry price is not.
            //
            // Unreproduced as an overlap, but the near miss is real: a window
            // with the entry line at about 31% put this tag within a few pixels
            // of a full-height readout. The threshold is a percentage against a
            // readout measured in pixels, so it cannot be exact — it is set
            // wide enough to cover the stage heights this renders at, and errs
            // toward flipping early because the left rim costs nothing.
            <span
              className={`pointer-events-none absolute font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/55 ${
                view.entryY < 35
                  ? "left-[var(--screen-rim,12px)]"
                  : "right-[var(--screen-rim,12px)]"
              }`}
              style={{ top: `calc(${view.entryY}% - 12px)` }}
            >
              Entry {entry != null && entry > 0 ? formatPrice(entry) : ""}
            </span>
          )}

          {/* The live price, tagged on the line itself.
              A number in the header tells you what BTC costs; this tells you
              where the line you are watching actually is, which is the thing the
              strike and the zone are measured against.

              Both tags ride the right rim, so when the price sits on the strike
              they land on each other — and that is exactly when a player is
              reading them hardest. Whichever is closer to the strike moves left;
              the ENTRY tag already flips when its own line is high, so this only
              has to handle the case where both want the same corner. */}
          <span
            className="pointer-events-none absolute flex items-center gap-1 font-mono text-[10px] font-extrabold tabular-nums"
            style={{
              top: `calc(${view.markY}% - 7px)`,
              /*
               * With a forward band the right rim belongs to it, and a price tag
               * anchored there lands on `NEXT` / `STRIKE NOT SET` — putting a
               * real price inside the region that has none. The tag belongs to
               * the line, so it ends where the line ends.
               */
              ...(next
                ? { right: `calc(${100 - view.past}% + 6px)` }
                : {
                    [view.entryY != null &&
                    view.entryY >= 35 &&
                    Math.abs(view.markY - view.entryY) < 9
                      ? "left"
                      : "right"]: "calc(var(--screen-rim, 12px) + 14px)",
                  }),
              color: tint,
              textShadow: `0 0 10px ${tint}77`,
            }}
          >
            <span aria-hidden>{view.rising ? "▲" : "▼"}</span>
            {formatPrice(view.last)}
          </span>

          {next && (
            <>
              {/* What the band is, and when it starts. The countdown is knowable
                  the moment the venue publishes the window; the level is not. */}
              <span
                className="pointer-events-none absolute top-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/60"
                style={{ left: `calc(${view.past}% + 5px)` }}
              >
                Next
              </span>
              {/* ENDS, not a bare number. This is when that window CLOSES —
                  the same measure as the header's countdown — and printed alone
                  beside a band labelled NEXT it reads as "starts in", which is a
                  different moment entirely. */}
              <span
                className="tnum pointer-events-none absolute top-[18px] font-mono text-[10px] font-extrabold text-white/80"
                style={{ left: `calc(${view.past}% + 5px)` }}
              >
                Ends {Math.max(0, Math.round(next.secsLeft))}s
              </span>
              {view.nextY != null ? (
                <span
                  className="pointer-events-none absolute font-mono text-[9px] font-bold tabular-nums text-brand-500"
                  style={{
                    left: `calc(${view.past}% + 5px)`,
                    top: `calc(${view.nextY}% - 12px)`,
                  }}
                >
                  {next.strike != null ? formatPrice(next.strike) : ""}
                </span>
              ) : (
                // Said plainly rather than left blank: the window is real, the
                // level is not decided yet. The reference prints a price here
                // before the chain has one.
                <span
                  className="pointer-events-none absolute top-[34px] max-w-[22%] font-mono text-[8px] font-bold uppercase leading-tight tracking-[0.08em] text-white/35"
                  style={{ left: `calc(${view.past}% + 5px)` }}
                >
                  Strike not set
                </span>
              )}
            </>
          )}

          <span
            className="pointer-events-none absolute bottom-1.5 left-[var(--screen-rim,12px)] font-mono text-[13px] font-extrabold tabular-nums"
            style={{ color: tint, textShadow: `0 0 10px ${tint}66` }}
          >
            {view.change >= 0 ? "+" : ""}
            {view.change.toFixed(2)}%
          </span>
        </>
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-3">
          Waiting for the feed
        </span>
      )}
    </div>
  );
}
