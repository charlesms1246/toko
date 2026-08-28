"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { THEMES } from "@/lib/console/themes";
import { playSfx } from "@/lib/sound";
import haptics from "@/lib/haptics";

const CARD_W = 152;
const CARD_H = 116;

export default function PresetCarousel({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (preset: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the active card centred as the selection moves.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current.get(selected);
    if (!scroller || !card) return;
    const target =
      card.offsetLeft - scroller.clientWidth / 2 + card.offsetWidth / 2;
    scroller.scrollTo({ left: target, behavior: "smooth" });
  }, [selected]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 py-6"
    >
      {THEMES.map((theme) => {
        const active = theme.id === selected;
        return (
          <motion.button
            key={theme.id}
            type="button"
            ref={(el) => {
              if (el) cardRefs.current.set(theme.id, el);
              else cardRefs.current.delete(theme.id);
            }}
            onClick={() => {
              if (active) return;
              playSfx("swipe");
              haptics.press("selection");
              onSelect(theme.id);
            }}
            className="relative shrink-0 snap-center overflow-hidden rounded-2xl text-left"
            style={{
              width: CARD_W,
              height: CARD_H,
              background: theme.cardBg,
              boxShadow: active
                ? "0 12px 28px rgba(0,0,0,.55), 0 0 0 2px rgba(255,255,255,.85)"
                : "0 6px 18px rgba(0,0,0,.4)",
            }}
            animate={
              active
                ? { rotate: -5, x: 4, y: -10, scale: 1.05 }
                : { rotate: 0, x: 0, y: 0, scale: 1 }
            }
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
          >
            {theme.cardImage && (
              // Skins are large and decorative; a plain img keeps them cheap
              // and avoids Next's optimizer on an SVG we control.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.cardImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {/* Glass sheen */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 44%, rgba(0,0,0,.16) 100%)",
              }}
            />

            {theme.badge && (
              <span
                className="absolute right-2 top-2 rounded-full px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(0,0,0,.55)",
                  color: "#fff",
                }}
              >
                {theme.badge}
              </span>
            )}

            <div className="absolute inset-x-3 bottom-2">
              <div
                className="text-[30px] font-black leading-none tabular-nums"
                style={{ color: theme.cardInk }}
              >
                {theme.code}
              </div>
              <div
                className="text-[11px] font-bold"
                style={{ color: theme.cardSub }}
              >
                {theme.name}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
