"use client";

import { playSfx } from "@/lib/sound";
import haptics from "@/lib/haptics";

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export default function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toko-switch-control shrink-0 ${checked ? "toko-switch-control-on" : ""} ${
        disabled ? "opacity-50" : ""
      }`}
      onClick={() => {
        if (disabled) {
          playSfx("disabled");
          return;
        }
        playSfx(checked ? "toggleOff" : "toggleOn");
        haptics.press("selection");
        onChange(!checked);
      }}
    >
      <span className={`toko-switch-thumb ${checked ? "toko-switch-thumb-on" : ""}`} />
    </button>
  );
}
