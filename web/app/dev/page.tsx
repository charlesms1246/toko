"use client";

import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { GAME_LABELS, LAB_GAMES, LIVE_GAMES, MINIGAMES } from "@/lib/api/types";

export default function DevIndex() {
  return (
    <>
      <MenuSection title="Console">
        <MenuRow label="Console harness" href="/dev/console" />
        <MenuRow label="Console (transparent)" href="/dev/console-transparent" />
        <MenuRow label="Export frames" href="/dev/export" />
      </MenuSection>

      <MenuSection title="Design">
        <MenuRow label="Design system" href="/dev/design-system" />
        <MenuRow label="Design system v2" href="/dev/design-system-v2" />
      </MenuSection>

      <MenuSection title="Feel">
        <MenuRow label="Sound bank" href="/dev/sounds" />
        <MenuRow label="Haptic patterns" href="/dev/haptics" />
      </MenuSection>

      <MenuSection title="Games">
        <MenuRow label="All games" href="/dev/games" />
        {[...LIVE_GAMES, ...LAB_GAMES].map((game) => (
          <MenuRow
            key={game}
            label={GAME_LABELS[game]}
            href={`/games/${game}`}
          />
        ))}
        {MINIGAMES.map((game) => (
          <MenuRow key={game} label={game} href={`/games/${game}`} />
        ))}
      </MenuSection>

      <MenuSection title="Admin">
        <MenuRow label="Dashboard" href="/admin" />
        <MenuRow label="Usage" href="/usage" />
        <MenuRow label="Performance" href="/perf" />
        <MenuRow label="Errors" href="/errors" />
      </MenuSection>
    </>
  );
}
