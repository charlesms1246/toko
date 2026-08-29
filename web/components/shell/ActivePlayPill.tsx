"use client";

/**
 * A floating pill shown when you have a live play on some *other* page.
 * Tapping it deep-links back to the game.
 */

import { usePathname, useRouter } from "next/navigation";
import { useCountdown, usePlays } from "@/lib/api/hooks";
import { GAME_LABELS, type GameId } from "@/lib/api/types";
import { playSfx } from "@/lib/sound";

export default function ActivePlayPill() {
  const pathname = usePathname();
  const router = useRouter();
  const open = usePlays("open", 5);

  const play = open[0];
  const { secsLeft } = useCountdown(play?.market.expiry);

  if (!play) return null;
  if (pathname === `/games/${play.game}`) return null;

  const pnl = Number(play.pnl);
  const label = GAME_LABELS[play.game as GameId] ?? play.game;

  return (
    <button
      type="button"
      onClick={() => {
        playSfx("tap");
        router.push(`/games/${play.game}`);
      }}
      className="fixed inset-x-0 top-3 z-[55] mx-auto flex w-fit items-center gap-3 rounded-full border border-[var(--color-line-strong)] bg-black/85 px-4 py-2 text-sm font-bold backdrop-blur"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
      </span>
      <span>{label} live</span>
      <span className="tabular-nums text-text-3">{secsLeft}s</span>
      <span
        className={`tabular-nums ${pnl >= 0 ? "text-up" : "text-down"}`}
      >
        {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
      </span>
    </button>
  );
}
