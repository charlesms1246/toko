"use client";

/**
 * The console customizer.
 *
 * Presets plus per-part recolouring. Recolouring the body drops the preset's
 * skin and its metallic/clear material mode — you cannot repaint a gold or
 * transparent shell — which `resolveTheme` enforces.
 */

import { useState } from "react";
import PresetCarousel from "@/components/customize/PresetCarousel";
import SwatchGrid from "@/components/customize/SwatchGrid";
import TapTarget from "@/components/ui/TapTarget";
import { useConsoleTheme } from "@/lib/console/theme-context";
import {
  BODY_SWATCHES,
  GLOW_SWATCHES,
  isCustomized,
  type PartKey,
} from "@/lib/console/themes";
import { useToast } from "@/components/ui/Toast";
import { playSfx } from "@/lib/sound";

const TABS: { id: "presets" | PartKey; label: string }[] = [
  { id: "presets", label: "Presets" },
  { id: "body", label: "Body" },
  { id: "play", label: "Play" },
  { id: "buttons", label: "Buttons" },
  { id: "knob", label: "Knob" },
  { id: "glow", label: "Glow" },
];

export default function CustomizePage() {
  const { custom, resolved, set } = useConsoleTheme();
  const [tab, setTab] = useState<"presets" | PartKey>("presets");
  const toast = useToast();

  const setPart = (part: PartKey, index: number) =>
    set({ ...custom, parts: { ...custom.parts, [part]: index } });

  return (
    <>
      <div className="no-scrollbar -mx-4 mb-1 flex items-baseline gap-5 overflow-x-auto px-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="relative shrink-0"
            onClick={() => {
              playSfx("tap");
              setTab(id);
            }}
          >
            <span
              className={`pointer-events-none whitespace-nowrap text-[26px] font-extrabold leading-none tracking-tight transition-colors ${
                tab === id ? "text-text" : "text-text-3"
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className="relative min-h-[160px]">
      {tab === "presets" ? (
        <PresetCarousel
          selected={custom.preset}
          onSelect={(preset) => set({ preset, parts: custom.parts })}
        />
      ) : (
        <div className="py-4">
          <SwatchGrid
            swatches={tab === "glow" ? GLOW_SWATCHES : BODY_SWATCHES}
            selected={custom.parts?.[tab]}
            onSelect={(index) => setPart(tab, index)}
          />
          {tab === "body" && (
            <p className="mt-3 px-1 text-[11px] leading-relaxed text-text-3">
              Picking a body colour removes the preset&apos;s skin and its gold
              or clear finish, and re-derives the silkscreen ink.
            </p>
          )}
        </div>
      )}
      </div>

      <div className="surface-skeuo rounded-card mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-extrabold">{resolved.name}</span>
          <span className="text-lg font-black tabular-nums text-text-3">
            {resolved.code}
          </span>
        </div>
        {isCustomized(custom) && (
          <div className="mt-1 text-[11px] font-semibold text-brand-500">
            Customized
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 pb-[max(8px,env(safe-area-inset-bottom))]">
        <TapTarget
          className="relative h-[58px] flex-1 rounded-full border border-[var(--color-line-strong)] text-[15px] font-bold text-text-2"
          onClick={() => set({ preset: custom.preset })}
        >
          Reset
        </TapTarget>
        <TapTarget
          className="relative h-[58px] flex-1 rounded-full border border-[var(--color-line-strong)] text-[15px] font-bold text-text-2"
          onClick={() =>
            toast("For now, show off your rig with your PnL card")
          }
        >
          Share
        </TapTarget>
        <TapTarget
          href="/games"
          className="relative grid h-[58px] flex-1 place-items-center rounded-full bg-brand-500 text-[15px] font-extrabold text-black"
          haptic="high"
        >
          Done
        </TapTarget>
      </div>
    </>
  );
}
