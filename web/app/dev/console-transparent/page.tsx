"use client";

/**
 * The same harness on a checkerboard rather than an ambient backdrop, so the
 * console can be captured with a transparent background for asset work.
 */

import { useState } from "react";
import ConsoleCanvas from "@/components/console/ConsoleCanvas";
import { THEMES, THEMES_BY_ID } from "@/lib/console/themes";
import { playSfx } from "@/lib/sound";

const CHECKER =
  "repeating-conic-gradient(#1a1a1c 0% 25%, #101012 0% 50%) 50% / 20px 20px";

export default function DevConsoleTransparentPage() {
  const [themeId, setThemeId] = useState("classic");

  return (
    <>
      <div
        className="relative mb-4 h-[460px] overflow-hidden rounded-2xl border border-[var(--color-line)]"
        style={{ background: CHECKER }}
      >
        <ConsoleCanvas theme={THEMES_BY_ID[themeId]} />
      </div>

      <div className="grid grid-cols-3 gap-2">
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
    </>
  );
}
