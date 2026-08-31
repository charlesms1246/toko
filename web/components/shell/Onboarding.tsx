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
import { APP, LINKS } from "@/lib/api/fixtures";
import { resumeAudio } from "@/lib/sound";
import {
  COLLATERAL,
  GAS,
  SIGNUP_GRANT,
  STT_FAUCETS,
  WEEKLY_GRANT,
} from "@/lib/dreamdex/config";
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
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center ${
        step === "landing"
          ? "pointer-events-none"
          : "justify-center bg-black/92 px-6 backdrop-blur-md"
      }`}
    >
      {step === "landing" && (
        <>
          {/* The console is the pitch, so it stays visible. A scrim over the
              lower half is all that is needed to seat the type on it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%]"
            style={{
              background:
                "linear-gradient(to top, #000 34%, #000000f0 58%, #00000080 80%, #0000 100%)",
            }}
          />
          <Image
            src="/assets/logos/toko-mark.svg"
            alt="TOKO"
            width={112}
            height={112}
            unoptimized
            className="relative z-10 mt-[max(28px,calc(env(safe-area-inset-top)+16px))] h-12 w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)] sm:h-14"
            priority
          />
          <div className="flex-1" />
          <div className="relative z-10 w-full max-w-sm px-6 pb-[max(28px,calc(env(safe-area-inset-bottom)+20px))] text-center">
            <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-text">
              {APP.tagline}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-snug text-text-2">
              {APP.description}
            </p>
            <TapTarget
              className="pointer-events-auto mt-6 h-14 w-full rounded-full bg-brand-500 text-lg font-extrabold text-black transition active:scale-[0.98]"
              haptic="high"
              onClick={() => {
                resumeAudio();
                setStep("starting");
                setTimeout(() => setStep("username"), 900);
              }}
            >
              START
            </TapTarget>
            <button
              type="button"
              onClick={onDemo}
              className="pointer-events-auto mt-3.5 text-sm font-semibold text-text-3 underline underline-offset-4 transition-colors hover:text-text-2"
            >
              Just exploring? Try demo mode
            </button>

            <div className="mt-6 flex items-center justify-center gap-3">
              <a
                href={LINKS.x}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-black"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
                </svg>
                Follow
              </a>
              <span className="h-4 w-px bg-[var(--color-line-strong)]" />
              <span className="text-left text-[9px] font-bold uppercase leading-tight tracking-[0.16em] text-text-3">
                Powered by
                <span className="block text-[11px] tracking-[0.08em] text-text-2">
                  DreamDEX
                </span>
              </span>
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-text-3">
              <span className="font-bold text-text-2">TOKO has no token.</span>{" "}
              Any coin claiming to be TOKO is a scam.
            </p>
          </div>
        </>
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
                is on us — every round you play settles on chain. Another{" "}
                {WEEKLY_GRANT} lands every week if you want it.
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
                    ? `Sending you ${SIGNUP_GRANT} ${COLLATERAL.symbol}…`
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
