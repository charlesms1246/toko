"use client";

import { useMemo } from "react";
import type { PricePoint } from "@/lib/api/prices";

/**
 * The 60-second price trace shown on the console screen. Optional horizontal
 * markers draw the strike.
 */
export default function Sparkline({
  points,
  markers = [],
  band,
  height = 64,
  tone = "brand",
}: {
  points: PricePoint[];
  /** Absolute price levels to draw as dashed lines. */
  markers?: { price: number; color: string; dashed?: boolean }[];
  /** Shaded corridor between two prices. */
  band?: { lower: number; upper: number; color: string };
  height?: number;
  tone?: "brand" | "up" | "down";
}) {
  const W = 300;
  const H = height;

  const { path, scale, last } = useMemo(() => {
    if (points.length < 2) {
      return { path: "", scale: null as null | ((p: number) => number), last: 0 };
    }

    const prices = points.map((p) => p.p);
    const levels = [
      ...prices,
      ...markers.map((m) => m.price),
      ...(band ? [band.lower, band.upper] : []),
    ];
    let min = Math.min(...levels);
    let max = Math.max(...levels);
    if (max - min < 1e-9) {
      const pad = Math.max(1e-9, Math.abs(max) * 1e-4);
      min -= pad;
      max += pad;
    }
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;

    const y = (price: number) => H - ((price - min) / (max - min)) * H;
    const t0 = points[0].t;
    const span = Math.max(1, points[points.length - 1].t - t0);
    const x = (t: number) => ((t - t0) / span) * W;

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(2)},${y(p.p).toFixed(2)}`)
      .join(" ");

    return { path: d, scale: y, last: prices[prices.length - 1] };
  }, [points, markers, band, H]);

  const stroke =
    tone === "up"
      ? "var(--color-up)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-brand-500)";

  if (!scale) {
    return <div style={{ height: H }} className="w-full" />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H, color: stroke }}
    >
      {band && (
        <rect
          x={0}
          y={scale(band.upper)}
          width={W}
          height={Math.max(1, scale(band.lower) - scale(band.upper))}
          fill={band.color}
          opacity={0.16}
        />
      )}

      {markers.map((marker, i) => (
        <line
          key={i}
          x1={0}
          x2={W}
          y1={scale(marker.price)}
          y2={scale(marker.price)}
          stroke={marker.color}
          strokeWidth={1}
          strokeDasharray={marker.dashed === false ? undefined : "4 4"}
          opacity={0.85}
        />
      ))}

      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={W} cy={scale(last)} r={2.6} fill={stroke} />
    </svg>
  );
}
