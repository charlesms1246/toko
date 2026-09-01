"use client";

import type { Swatch } from "@/lib/console/themes";
import { playSfx } from "@/lib/sound";
import haptics from "@/lib/haptics";

export default function SwatchGrid({
  swatches,
  selected,
  onSelect,
}: {
  swatches: Swatch[];
  selected: number | undefined;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 justify-items-center gap-y-4 px-1 py-2">
      {swatches.map((swatch, index) => (
        <button
          key={swatch.hex}
          type="button"
          title={swatch.name}
          aria-label={swatch.name}
          aria-pressed={selected === index}
          onClick={() => {
            playSfx("tap");
            haptics.press("selection");
            onSelect(index);
          }}
          className="relative h-[46px] w-[46px] rounded-full transition active:scale-95"
          style={{
            width: 46,
            height: 46,
            background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 46%), ${swatch.hex}`,
            boxShadow:
              selected === index
                ? "0 0 0 2.5px #0a0a0b, 0 0 0 5px #ffffff"
                : "inset 0 -2px 6px rgba(0,0,0,.35)",
          }}
        />
      ))}
    </div>
  );
}
