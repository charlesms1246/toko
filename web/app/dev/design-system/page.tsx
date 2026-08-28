"use client";

import { useState } from "react";
import { MenuRow, MenuSection, StatTile } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import Switch from "@/components/ui/Switch";
import Sheet from "@/components/ui/Sheet";
import GameIcon from "@/components/games/GameIcon";
import { useToast } from "@/components/ui/Toast";
import { LAB_GAMES, LIVE_GAMES } from "@/lib/api/types";

const TOKENS: [string, string][] = [
  ["canvas", "var(--color-canvas)"],
  ["surface-2", "var(--color-surface-2)"],
  ["line", "var(--color-line)"],
  ["line-strong", "var(--color-line-strong)"],
  ["brand-300", "var(--color-brand-300)"],
  ["brand-400", "var(--color-brand-400)"],
  ["brand-500", "var(--color-brand-500)"],
  ["premium-500", "var(--color-premium-500)"],
  ["up", "var(--color-up)"],
  ["down", "var(--color-down)"],
  ["info", "var(--color-info)"],
  ["viz-cyan", "var(--color-viz-cyan)"],
  ["text", "var(--color-text)"],
  ["text-2", "var(--color-text-2)"],
  ["text-3", "var(--color-text-3)"],
];

export default function DesignSystemPage() {
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const toast = useToast();

  return (
    <>
      <MenuSection title="Color">
        <div className="grid grid-cols-3 gap-2 p-3">
          {TOKENS.map(([name, value]) => (
            <div key={name} className="text-center">
              <div
                className="h-12 w-full rounded-xl border border-[var(--color-line)]"
                style={{ background: value }}
              />
              <div className="mt-1 text-[10px] font-semibold text-text-3">
                {name}
              </div>
            </div>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Type">
        <div className="space-y-2 p-4">
          <div className="font-display text-3xl font-bold">Open Runde 3xl</div>
          <div className="text-2xl font-black">Gabarito black 2xl</div>
          <div className="text-base font-bold">Gabarito bold base</div>
          <div className="text-sm text-text-2">Gabarito regular sm / text-2</div>
          <div className="text-xs text-text-3">Gabarito xs / text-3</div>
          <div className="font-mono text-sm tabular-nums">1234567890 mono</div>
        </div>
      </MenuSection>

      <MenuSection title="Buttons">
        <div className="flex flex-wrap gap-2 p-3">
          <TapTarget className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-extrabold text-black">
            Primary
          </TapTarget>
          <TapTarget className="rounded-full border border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-bold text-text-2">
            Secondary
          </TapTarget>
          <TapTarget
            disabled
            className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-bold text-text-3 opacity-50"
          >
            Disabled
          </TapTarget>
        </div>
      </MenuSection>

      <MenuSection title="Switch">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-bold">Toggle</span>
          <Switch checked={on} onChange={setOn} label="Demo" />
        </div>
      </MenuSection>

      <MenuSection title="Stat tiles">
        <div className="grid grid-cols-3 gap-2 p-3">
          <StatTile label="Neutral" value="128" />
          <StatTile label="Up" value="+$42" tone="up" />
          <StatTile label="Down" value="-$18" tone="down" />
        </div>
      </MenuSection>

      <MenuSection title="Game icons">
        <div className="flex flex-wrap gap-4 p-4 text-brand-500">
          {[...LIVE_GAMES, ...LAB_GAMES].map((game) => (
            <div key={game} className="flex flex-col items-center gap-1">
              <GameIcon game={game} size={30} />
              <span className="text-[10px] text-text-3">{game}</span>
            </div>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Overlays">
        <MenuRow label="Open sheet" onClick={() => setSheet(true)} />
        <MenuRow label="Toast (neutral)" onClick={() => toast("Just so you know")} />
        <MenuRow label="Toast (win)" onClick={() => toast("You won $42.00", "win")} />
        <MenuRow label="Toast (lose)" onClick={() => toast("Rekt for $18.00", "lose")} />
      </MenuSection>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Example sheet">
        <p className="text-sm text-text-2">
          Bottom sheets rise on a spring and fall a little faster than they rise.
        </p>
      </Sheet>
    </>
  );
}
