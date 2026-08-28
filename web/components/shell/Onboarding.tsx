"use client";

/**
 * The ordered gates a new player passes through before the console becomes
 * playable: landing -> onboarding -> username -> welcome -> customize.
 */

import Image from "next/image";
import { useState } from "react";
import TapTarget from "@/components/ui/TapTarget";
import PresetCarousel from "@/components/customize/PresetCarousel";
import { useConsoleTheme } from "@/lib/console/theme-context";
import { useStoreActions } from "@/lib/api/hooks";
import { APP } from "@/lib/api/fixtures";
import { resumeAudio } from "@/lib/sound";

type Step = "landing" | "starting" | "username" | "welcome" | "customize";

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("landing");
  const [handle, setHandle] = useState("");
  const { setUsername } = useStoreActions();
  const { custom, set } = useConsoleTheme();

  const handleValid = handle.length >= 3 && handle.length <= 20;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/92 px-6 backdrop-blur-md">
      {step === "landing" && (
        <div className="flex max-w-sm flex-col items-center text-center">
          <Image
            src="/assets/logos/toko-mark.svg"
            alt="TOKO"
            width={132}
            height={132}
            unoptimized
            className="mb-6 drop-shadow-[0_12px_32px_rgba(255,192,22,0.28)]"
            priority
          />
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {APP.name}
          </h1>
          <p className="mt-2 text-lg font-semibold text-brand-500">
            {APP.tagline}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-text-2">
            {APP.description}
          </p>
          <TapTarget
            className="mt-8 w-full rounded-full bg-brand-500 px-8 py-4 text-base font-extrabold text-black transition active:scale-[0.98]"
            haptic="high"
            onClick={() => {
              resumeAudio();
              setStep("starting");
              setTimeout(() => setStep("username"), 900);
            }}
          >
            START
          </TapTarget>
        </div>
      )}

      {step === "starting" && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
          <p className="text-sm font-semibold text-text-2">Starting...</p>
        </div>
      )}

      {step === "username" && (
        <div className="flex w-full max-w-sm flex-col">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Pick your handle
          </h2>
          <p className="mt-1 text-sm text-text-2">
            3–20 characters. This is how you show up on the leaderboard.
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[var(--color-line-strong)] bg-white/5 px-4 py-3">
            <span className="text-lg font-bold text-text-3">@</span>
            <input
              autoFocus
              value={handle}
              onChange={(e) =>
                setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))
              }
              placeholder="yourhandle"
              className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-text-3"
            />
          </div>
          <TapTarget
            className="mt-6 w-full rounded-full bg-brand-500 px-8 py-4 text-base font-extrabold text-black disabled:opacity-40"
            disabled={!handleValid}
            haptic="high"
            onClick={() => {
              setUsername(handle);
              setStep("welcome");
            }}
          >
            Continue
          </TapTarget>
        </div>
      )}

      {step === "welcome" && (
        <button
          type="button"
          className="flex max-w-sm flex-col items-center text-center"
          onClick={() => setStep("customize")}
        >
          <Image
            src="/assets/logos/toko-mark.svg"
            alt=""
            width={120}
            height={120}
            unoptimized
            style={{ animation: "welcome-pop .5s cubic-bezier(.16,1,.3,1) both" }}
          />
          <h2 className="mt-6 text-2xl font-extrabold tracking-tight">
            We&apos;ve sent you 250 chips
          </h2>
          <p className="mt-2 text-sm text-text-2">
            Chips are USDC on Somnia testnet. Play with them however you like.
          </p>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-text-3">
            Press any button to continue
          </p>
        </button>
      )}

      {step === "customize" && (
        <div className="flex w-full max-w-md flex-col">
          <h2 className="text-2xl font-extrabold tracking-tight">Make it yours</h2>
          <p className="mt-1 text-sm text-text-2">
            Pick a skin. Change it anytime.
          </p>
          <div className="mt-6">
            <PresetCarousel
              selected={custom.preset}
              onSelect={(preset) => set({ ...custom, preset })}
            />
          </div>
          <TapTarget
            className="mt-8 w-full rounded-full bg-brand-500 px-8 py-4 text-base font-extrabold text-black"
            haptic="high"
            onClick={onDone}
          >
            Let&apos;s play
          </TapTarget>
        </div>
      )}
    </div>
  );
}
