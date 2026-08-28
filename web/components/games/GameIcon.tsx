"use client";

import type { GameId } from "@/lib/api/types";

/**
 * The eight money games ship as single-color SVGs, used as masks so they can be
 * tinted to whatever the surrounding UI needs.
 */
export default function GameIcon({
  game,
  size = 28,
  className = "",
}: {
  game: GameId;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-current ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: `url(/assets/games/icon-${game}.svg)`,
        WebkitMaskImage: `url(/assets/games/icon-${game}.svg)`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
