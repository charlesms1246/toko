"use client";

import { MenuSection } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import haptics, {
  type OutcomePreset,
  type PressPreset,
} from "@/lib/haptics";

const PRESS: PressPreset[] = [
  "tick",
  "tickSmall",
  "low",
  "selection",
  "mid",
  "medium",
  "high",
  "rigid",
  "heavy",
  "success",
  "warning",
  "error",
];

const OUTCOMES: OutcomePreset[] = ["win", "lose", "cashOut", "achievement"];

export default function DevHapticsPage() {
  const supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  return (
    <>
      {!supported && (
        <div className="mb-4 rounded-2xl border border-[var(--color-line-strong)] bg-white/[.03] p-3 text-[11px] text-text-3">
          This browser has no <code>navigator.vibrate</code>, so nothing will be
          felt here. The patterns still fire.
        </div>
      )}

      <MenuSection title="Press">
        <div className="grid grid-cols-3 gap-2 p-3">
          {PRESS.map((preset) => (
            <TapTarget
              key={preset}
              haptic={null}
              className="rounded-xl border border-[var(--color-line-strong)] px-2 py-2.5 text-[11px] font-bold text-text-2"
              onClick={() => haptics.press(preset)}
            >
              {preset}
            </TapTarget>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Outcome">
        <div className="grid grid-cols-2 gap-2 p-3">
          {OUTCOMES.map((name) => (
            <TapTarget
              key={name}
              haptic={null}
              className="rounded-xl border border-[var(--color-line-strong)] px-2 py-2.5 text-[11px] font-bold text-text-2"
              onClick={() => haptics.outcome(name)}
            >
              {name}
            </TapTarget>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Detent">
        <div className="p-3">
          <TapTarget
            haptic={null}
            className="w-full rounded-xl border border-[var(--color-line-strong)] px-2 py-2.5 text-[11px] font-bold text-text-2"
            onClick={() => {
              for (let i = 0; i < 5; i++) haptics.detent();
            }}
          >
            Five detents (queued, 25ms apart)
          </TapTarget>
        </div>
      </MenuSection>

      <p className="px-1 text-[11px] leading-relaxed text-text-3">
        Intensity is emulated with PWM: a 20ms window is sliced into on/off
        chunks proportional to the requested strength, since{" "}
        <code>navigator.vibrate</code> has no amplitude control.
      </p>
    </>
  );
}
