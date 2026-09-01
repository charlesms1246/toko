"use client";

/** A bare ConsoleCanvas harness — its own scene, independent of the shell. */

import { useState } from "react";
import ConsoleCanvas from "@/components/console/ConsoleCanvas";
import { MenuSection } from "@/components/menu/MenuUI";
import { THEMES, THEMES_BY_ID, ambientFor } from "@/lib/console/themes";
import type { ButtonKey } from "@/lib/console/geometry";
import { playSfx } from "@/lib/sound";

export default function DevConsolePage() {
  const [themeId, setThemeId] = useState("classic");
  const [lastPress, setLastPress] = useState<ButtonKey | null>(null);
  const [knob, setKnob] = useState(0);
  const [wheel, setWheel] = useState(0);
  const theme = THEMES_BY_ID[themeId];

  return (
    <>
      <div
        className="relative mb-4 h-[420px] overflow-hidden rounded-card border border-[var(--color-line)]"
        style={{ background: ambientFor(theme) }}
      >
        <ConsoleCanvas
          theme={theme}
          keyGlow={{ play: 0.4, action1: 0.25, action2: 0.25 }}
          onPress={setLastPress}
          onKnobStep={(s) => setKnob((v) => v + s)}
          onWheelStep={(s) => setWheel((v) => v + s)}
        />
      </div>

      <MenuSection title="State">
        <div className="grid grid-cols-3 gap-2 p-3 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-3">
              Last press
            </div>
            <div className="text-sm font-bold">{lastPress ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-3">
              Knob
            </div>
            <div className="text-sm font-bold tabular-nums">{knob}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-3">
              Wheel
            </div>
            <div className="text-sm font-bold tabular-nums">{wheel}</div>
          </div>
        </div>
      </MenuSection>

      <MenuSection title="Preset">
        <div className="grid grid-cols-3 gap-2 p-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                playSfx("swipe");
                setThemeId(t.id);
              }}
              className={`rounded-xl px-2 py-2 text-[11px] font-bold transition ${
                t.id === themeId
                  ? "ring-2 ring-white"
                  : "border border-[var(--color-line-strong)]"
              }`}
              style={{ background: t.cardBg, color: t.cardInk }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </MenuSection>

      <p className="px-1 text-[11px] leading-relaxed text-text-3">
        Drag the knob or thumbwheel to step them. Arrow keys and Enter drive the
        keys; the shell binds the same mapping.
      </p>
    </>
  );
}
