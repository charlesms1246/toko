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

const UP = "#34d399";
const DOWN = "#ff5a4d";

export default function PriceChart({
  asset,
  entry,
  className = "",
  bare = false,
}: {
  asset: string;
  /** The window's opening price — the level the settlement compares against. */
  entry?: number | null;
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
    const pad = (hi - lo) * 0.14 || Math.max(1, hi * 0.0004);
    lo -= pad;
    hi += pad;

    const W = 100;
    const H = 100;
    const x = (i: number) => (i / (ps.length - 1)) * W;
    const y = (p: number) => H - ((p - lo) / (hi - lo || 1)) * H;

    const line = ps.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" ");
    const base = entry != null && entry > 0 ? entry : first;

    return {
      line,
      area: `0,${H} ${line} ${W},${H}`,
      entryY: entry != null && entry > 0 ? y(entry) : null,
      markX: x(ps.length - 1),
      markY: y(last),
      rising: last >= base,
      change: base > 0 ? ((last - base) / base) * 100 : 0,
    };
  }, [points, entry]);

  const tint = view?.rising === false ? DOWN : UP;

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

            {view.entryY != null && (
              <line
                x1="0"
                y1={view.entryY}
                x2="100"
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
              Entry
            </span>
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
