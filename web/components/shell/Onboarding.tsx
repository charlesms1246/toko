"use client";

/**
 * The ordered gates a new player passes through before the console becomes
 * playable: landing -> starting -> username -> funding -> customize.
 *
 * The landing step also offers the way *round* it: Demo Mode, which hands over
 * the console with live markets and hypothetical fills and no wallet at all.
 *
 * The funding gate is the one that matters. A visitor arrives with a wallet
 * generated in their browser and nothing in it, so this is where the treasury
 * sends them STT for gas and the collateral contract's faucet sends them tUSDC
 * — two real transactions on Shannon, which is why the step shows its progress
 * and its result rather than pretending to be instant.
 *
 * It never blocks: if the treasury is dry or unconfigured it says so, points at
 * the public faucets, and lets the player through.
 */

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import TapTarget from "@/components/ui/TapTarget";
import PresetCarousel from "@/components/customize/PresetCarousel";
import { useConsoleTheme } from "@/lib/console/theme-context";
import { useStoreActions } from "@/lib/api/hooks";
import { APP } from "@/lib/api/fixtures";
import { resumeAudio } from "@/lib/sound";
import { COLLATERAL, GAS, STT_FAUCETS } from "@/lib/dreamdex/config";
import * as demo from "@/lib/demo";
import * as wallet from "@/lib/dreamdex/wallet";

type Step = "landing" | "starting" | "username" | "funding" | "customize";

export default function Onboarding({
  onDone,
  onDemo,
}: {
  onDone: () => void;
  /** Try the console before signing up. Live markets, hypothetical fills. */
  onDemo: () => void;
}) {
  const [step, setStep] = useState<Step>("landing");
  const [handle, setHandle] = useState("");
  const [stage, setStage] = useState<wallet.FundingStage | null>(null);
  /** What they did in demo, if they came that way. Read once, on mount. */
  const [past] = useState(() => demo.pastRun());
  const [fundError, setFundError] = useState<string | null>(null);
  const { setUsername } = useStoreActions();
  const { custom, set } = useConsoleTheme();
  const funds = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  const handleValid = handle.length >= 3 && handle.length <= 20;

  /**
   * Started from the press rather than an effect, so the two transactions are
   * something the player set going.
   */
  const fund = () => {
    setStep("funding");
    setStage(null);
    setFundError(null);
    void wallet.ensureFunded(setStage).then((result) => {
      if (!result.ok) setFundError(result.reason ?? "Could not fund your wallet");
    });
  };

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
          <TapTarget
            className="mt-3 w-full rounded-full border border-[var(--color-line-strong)] px-8 py-4 text-base font-extrabold text-text-2 transition active:scale-[0.98]"
            haptic="low"
            onClick={onDemo}
          >
            Try it first
          </TapTarget>
          <p className="mt-3 px-2 text-[11px] leading-relaxed text-text-3">
            Real markets, real prices, real settlement — only your fills are
            pretend. No wallet needed.
          </p>
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
              fund();
            }}
          >
            Continue
          </TapTarget>
        </div>
      )}

      {step === "funding" && (
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          {stage === "done" && !fundError ? (
            <>
              <Image
                src="/assets/logos/toko-mark.svg"
                alt=""
                width={120}
                height={120}
                unoptimized
                style={{ animation: "welcome-pop .5s cubic-bezier(.16,1,.3,1) both" }}
              />
              <h2 className="mt-6 text-2xl font-extrabold tracking-tight">
                You&apos;re funded
              </h2>
              <div className="mt-3 text-4xl font-black tabular-nums text-brand-500">
                {wallet.formatCollateral(funds.collateral)}
              </div>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-text-3">
                {COLLATERAL.symbol} · Somnia testnet
              </p>
              <p className="mt-4 text-sm leading-relaxed text-text-2">
                Real testnet collateral, in a wallet only this browser holds. Gas
                is on us — every round you play settles on chain.
              </p>
              {past && past.rounds > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-text-3">
                  You played{" "}
                  <span className="font-bold text-text-2">
                    {past.rounds} {past.rounds === 1 ? "round" : "rounds"}
                  </span>{" "}
                  in demo and finished on{" "}
                  <span className="font-bold text-text-2">
                    ${(Number(past.balance) / 1e6).toFixed(2)}
                  </span>
                  . From here it counts.
                </p>
              )}
              <TapTarget
                className="mt-8 w-full rounded-full bg-brand-500 px-8 py-4 text-base font-extrabold text-black"
                haptic="high"
                onClick={() => setStep("customize")}
              >
                Continue
              </TapTarget>
            </>
          ) : fundError ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Grab some {GAS.symbol} first
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{fundError}</p>
              <div className="mt-6 w-full">
                {STT_FAUCETS.map((faucet) => (
                  <a
                    key={faucet.id}
                    href={faucet.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 flex items-center justify-between rounded-2xl border border-[var(--color-line-strong)] bg-white/5 px-4 py-3 text-left"
                  >
                    <span className="text-sm font-bold">{faucet.name}</span>
                    <span className="text-[11px] text-text-3">{faucet.detail}</span>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-3">
                Send it to the address on your wallet screen, then take the
                {` ${COLLATERAL.symbol} `}faucet there too.
              </p>
              <TapTarget
                className="mt-6 w-full rounded-full border border-[var(--color-line-strong)] px-8 py-4 text-base font-extrabold"
                haptic="high"
                onClick={() => setStep("customize")}
              >
                Continue anyway
              </TapTarget>
            </>
          ) : (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
              <p className="mt-4 text-sm font-semibold text-text-2">
                {stage === "gas"
                  ? `Sending you ${GAS.symbol} for gas…`
                  : stage === "collateral"
                    ? `Sending you 10,000 ${COLLATERAL.symbol}…`
                    : "Creating your wallet…"}
              </p>
              <p className="mt-2 text-[11px] text-text-3">
                Two transactions on Somnia. A few seconds.
              </p>
            </>
          )}
        </div>
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
