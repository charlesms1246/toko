"use client";

import { MenuSection } from "@/components/menu/MenuUI";
import Sparkline from "@/components/games/Sparkline";
import { usePriceHistory } from "@/lib/api/hooks";
import { THEMES } from "@/lib/console/themes";
import { BODY_SWATCHES, GLOW_SWATCHES } from "@/lib/console/themes";

export default function DesignSystemV2Page() {
  const points = usePriceHistory("BTC");

  return (
    <>
      <MenuSection title="Console presets">
        <div className="grid grid-cols-3 gap-2 p-3">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className="overflow-hidden rounded-xl"
              style={{ background: theme.cardBg }}
            >
              <div className="p-2">
                <div
                  className="text-base font-black tabular-nums leading-none"
                  style={{ color: theme.cardInk }}
                >
                  {theme.code}
                </div>
                <div
                  className="text-[10px] font-bold"
                  style={{ color: theme.cardSub }}
                >
                  {theme.name}
                </div>
              </div>
              <div className="flex">
                {[theme.main, theme.action, theme.pills, theme.knob].map(
                  (color, i) => (
                    <span
                      key={i}
                      className="h-3 flex-1"
                      style={{ background: color }}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Body swatches">
        <div className="grid grid-cols-6 gap-2 p-3">
          {BODY_SWATCHES.map((s) => (
            <div
              key={s.hex}
              title={s.name}
              className="aspect-square rounded-full"
              style={{
                background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 46%), ${s.hex}`,
              }}
            />
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Glow swatches">
        <div className="grid grid-cols-6 gap-2 p-3">
          {GLOW_SWATCHES.map((s) => (
            <div
              key={s.hex}
              title={s.name}
              className="aspect-square rounded-full"
              style={{
                background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 46%), ${s.hex}`,
                boxShadow: `0 0 12px ${s.hex}`,
              }}
            />
          ))}
        </div>
      </MenuSection>

      <MenuSection title="Sparkline">
        <div className="space-y-4 p-3">
          <Sparkline points={points} height={60} />
          <Sparkline points={points} height={60} tone="up" />
          <Sparkline points={points} height={60} tone="down" />
        </div>
      </MenuSection>
    </>
  );
}
