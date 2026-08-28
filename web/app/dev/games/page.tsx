"use client";

import { MenuSection, MenuRow } from "@/components/menu/MenuUI";
import GameIcon from "@/components/games/GameIcon";
import { GAME_TAGLINES } from "@/lib/api/fixtures";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, MINIGAMES } from "@/lib/api/types";
import TapTarget from "@/components/ui/TapTarget";

const MINIGAME_LABELS: Record<string, string> = {
  "line-rider": "Line Rider",
  "flappy-piper": "Flappy Piper",
};

export default function DevGamesPage() {
  return (
    <>
      <MenuSection title="Live">
        {LIVE_GAMES.map((game) => (
          <TapTarget
            key={game}
            href={`/games/${game}`}
            className="flex w-full items-center gap-3 border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0"
          >
            <span className="text-brand-500">
              <GameIcon game={game} size={24} />
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold">{GAME_LABELS[game]}</div>
              <div className="text-[11px] text-text-3">
                {GAME_TAGLINES[game]}
              </div>
            </div>
          </TapTarget>
        ))}
      </MenuSection>

      <MenuSection title="Lab (admin only)">
        {LAB_GAMES.map((game) => (
          <TapTarget
            key={game}
            href={`/games/${game}`}
            className="flex w-full items-center gap-3 border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0"
          >
            <span className="text-[var(--color-premium-500)]">
              <GameIcon game={game} size={24} />
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold">{GAME_LABELS[game]}</div>
              <div className="text-[11px] text-text-3">
                {GAME_TAGLINES[game]}
              </div>
            </div>
          </TapTarget>
        ))}
      </MenuSection>

      <MenuSection title="Free minigames">
        {MINIGAMES.map((game) => (
          <MenuRow
            key={game}
            label={MINIGAME_LABELS[game]}
            href={`/games/${game}`}
          />
        ))}
      </MenuSection>
    </>
  );
}
