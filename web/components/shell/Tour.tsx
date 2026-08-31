"use client";

/** The onboarding tour, with the anti-scam notice on the final card. */

import Image from "next/image";
import { useState } from "react";
import TapTarget from "@/components/ui/TapTarget";

interface Stop {
  tag: string;
  copy: string;
}

const STOPS: Stop[] = [
  { tag: "The screen", copy: "Live price, your play, your result. All on this screen." },
  { tag: "Main button", copy: "This fires your play. The big one. Tap it to play." },
  { tag: "Play amount", copy: "Roll this to size how much each play costs." },
  { tag: "The dial", copy: "The payout you are asking for — which is really a price." },
  { tag: "The menu", copy: "Stats, history, cash out, customize." },
  { tag: "You're set", copy: "Pick a game, hit play, see what you get." },
];

export default function Tour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const stop = STOPS[index];
  const last = index === STOPS.length - 1;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--color-line-strong)] bg-[#141416] p-5">
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
