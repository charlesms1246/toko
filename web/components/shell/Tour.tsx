"use client";

/**
 * The onboarding tour, with the anti-scam notice on the final card.
 *
 * Every stop points at the control it is describing. It used to be a modal
 * pinned to the bottom of the *viewport* that named five pieces of hardware and
 * indicated none of them — the copy said "the big one" while nothing on screen
 * said which one that was.
 *
 * The console publishes each control's projected rect to the document element as
 * `--anchor-<name>-x/y/w/h`, refreshed on every frame it renders. This reads
 * those, cuts a hole in the scrim over the control, and puts the card on
 * whichever side of it has room. That is why the stops carry an `anchor` — it is
 * the whole mechanism, not a label.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import TapTarget from "@/components/ui/TapTarget";

interface Stop {
  /** Matches the `--anchor-<name>-*` set the console publishes. */
  anchor: string | null;
  tag: string;
  copy: string;
}

const STOPS: Stop[] = [
  { anchor: "screen", tag: "The screen", copy: "Live price, your play, your result. All on this screen." },
  { anchor: "play", tag: "Main button", copy: "This fires your play. The big one. Tap it to play." },
  { anchor: "amount", tag: "Play amount", copy: "Roll this to size how much each play costs." },
  { anchor: "knob", tag: "The dial", copy: "The payout you are asking for — which is really a price." },
  { anchor: "menu", tag: "The menu", copy: "Stats, history, cash out, customize." },
  { anchor: null, tag: "You're set", copy: "Pick a game, hit play, see what you get." },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function readAnchor(name: string | null): Rect | null {
  if (!name || typeof window === "undefined") return null;
  const style = getComputedStyle(document.documentElement);
  const px = (prop: string) =>
    parseFloat(style.getPropertyValue(`--anchor-${name}-${prop}`));
  const rect = { x: px("x"), y: px("y"), w: px("w"), h: px("h") };
  // The console has not laid out yet, or this build does not publish the rect.
  // Either way there is nothing to point at, so the stop falls back to centred.
  if (Object.values(rect).some((v) => !Number.isFinite(v)) || rect.w <= 0) {
    return null;
  }
  return rect;
}

/**
 * The live rect for one anchor.
 *
 * The lazy initialiser reads synchronously so the very first paint already has
 * the hole in the right place rather than flashing a full-screen scrim. After
 * that the rAF re-reads: on a stop change, and for the case where the console
 * has not laid out yet when the tour opens.
 */
function useAnchor(name: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(() => readAnchor(name));

  useEffect(() => {
    const read = () => setRect(readAnchor(name));
    const raf = requestAnimationFrame(read);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", read);
    };
  }, [name]);

  return rect;
}

export default function Tour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const stop = STOPS[index];
  const last = index === STOPS.length - 1;
  const rect = useAnchor(stop.anchor);

  const pad = 10;
  // Above the control if there is room below it, otherwise below. The card is
  // ~200px tall; anything closer than that to an edge gets flipped.
  const cardAbove = rect ? rect.y > 260 : false;

  return (
    <div className="fixed inset-0 z-[65]">
      {/* The scrim, with the control cut out of it. Four panels rather than a
          box-shadow so the hole stays crisp against the 3D shell behind it. */}
      {rect ? (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-black/60 backdrop-blur-[2px]"
            style={{ height: Math.max(0, rect.y - pad) }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[2px]"
            style={{ top: rect.y + rect.h + pad }}
          />
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: rect.y - pad,
              height: rect.h + pad * 2,
              left: 0,
              width: Math.max(0, rect.x - pad),
            }}
          />
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: rect.y - pad,
              height: rect.h + pad * 2,
              left: rect.x + rect.w + pad,
              right: 0,
            }}
          />
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-brand-500"
            style={{
              left: rect.x - pad,
              top: rect.y - pad,
              width: rect.w + pad * 2,
              height: rect.h + pad * 2,
              boxShadow: "0 0 0 1px #000a, 0 0 24px 4px rgba(255,192,22,.45)",
              animation: "viz-pulse 1.8s ease-in-out infinite",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      )}

      <div
        className="absolute left-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-[var(--color-line-strong)] bg-[#141416] p-5"
        style={
          rect
            ? cardAbove
              ? { bottom: `calc(100% - ${rect.y - pad - 14}px)` }
              : { top: rect.y + rect.h + pad + 14 }
            : // Y only. The class above centres X with Tailwind's `translate`
              // PROPERTY, which composes with `transform` rather than being
              // overridden by it — so a `translate(-50%, -50%)` here shifted the
              // card by a full width, off the left edge of the column. The last
              // stop is the one with no anchor, which is why it was the only
              // card that went missing.
              { top: "50%", transform: "translateY(-50%)" }
        }
      >
        <div className="flex items-center gap-2">
          {STOPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= index ? "bg-brand-500" : "bg-white/12"
              }`}
            />
          ))}
        </div>

        <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
          {stop.tag}
        </h3>
        <p className="mt-2 text-lg font-bold leading-snug">{stop.copy}</p>

        {last && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[var(--color-down)]/40 bg-[var(--color-down)]/10 p-3">
              <p className="text-xs leading-relaxed text-text-2">
                <strong className="text-text">TOKO has no token.</strong> We have
                never launched one. Any coin, presale, or airdrop claiming to be
                TOKO is a scam.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 opacity-70">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-3">
                Powered by
              </span>
              <Image
                src="/assets/logos/somnia-logo.png"
                alt="Somnia"
                width={22}
                height={22}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <TapTarget
            className="flex-1 rounded-full border border-[var(--color-line-strong)] px-5 py-3 text-sm font-bold text-text-2"
            onClick={onDone}
          >
            Skip
          </TapTarget>
          <TapTarget
            className="flex-[2] rounded-full bg-brand-500 px-5 py-3 text-sm font-extrabold text-black"
            haptic="medium"
            onClick={() => (last ? onDone() : setIndex(index + 1))}
          >
            {last ? "Start playing" : "Next"}
          </TapTarget>
        </div>
      </div>
    </div>
  );
}
