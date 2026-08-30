"use client";

/**
 * Taking a challenge — `/c/<code>`.
 *
 * The code is a pointer, not a record. Everything shown here is re-read from the
 * pool: whether the challenger's bid is still resting, what the window is, how
 * long is left. A link can say anything; the chain decides.
 *
 * **This is the one screen Demo Mode cannot cover.** Accepting means buying the
 * opposite outcome so it crosses the challenger's *real* resting order and the
 * pool mints a pair. A paper fill has nothing to cross with — there is no second
 * order, so no pair is minted and the challenger is left waiting. So an
 * un-onboarded visitor is told to onboard rather than shown a simulation of a
 * trade that never happened.
 *
 * The quoted cost is a **ceiling**, not a promise. The pool matches at the best
 * price available, so an accepting order can fill cheaper than the challenge
 * asked — and, if the challenger is not at the front of the book, against
 * somebody else entirely. Both were measured on chain.
 */

import { use, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ScreenRoot, ScreenHeader, ScreenRow, BigNumber } from "@/components/screen/Screen";
import { useProgramConsole } from "@/lib/console/controls";
import * as coop from "@/lib/dreamdex/coop";
import * as markets from "@/lib/dreamdex/markets";
import * as wallet from "@/lib/dreamdex/wallet";
import * as onboarding from "@/lib/onboarding";

type Phase = "reading" | "ready" | "taking" | "took" | "failed";

export default function ChallengePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const challenge = coop.decode(code);

  const [status, setStatus] = useState<coop.ChallengeStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("reading");
  const [error, setError] = useState<string | null>(null);
  /** Who the fill was actually against — not always the link's challenger. */
  const [maker, setMaker] = useState<`0x${string}` | null>(null);

  const gates = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );
  const me = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  useEffect(() => {
    onboarding.hydrate();
    wallet.ensureWallet();
    void wallet.refresh();
    return markets.startPolling(3000);
  }, []);

  // Re-read the challenge off the chain while it is still takeable. A resting
  // order is public, so it can disappear at any moment without our involvement.
  useEffect(() => {
    if (!challenge || phase === "taking" || phase === "took") return;
    let cancelled = false;
    const read = async () => {
      const next = await coop.status(challenge);
      if (cancelled) return;
      setStatus(next);
      setPhase((p) => (p === "reading" ? "ready" : p));
    };
    void read();
    const timer = setInterval(() => void read(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [challenge, phase]);

  const take = useCallback(() => {
    if (!challenge || !status?.window) return;
    setPhase("taking");
    setError(null);
    void (async () => {
      const result = await coop.accept(challenge, status.window!);
      if (!result.ok) {
        setPhase("failed");
        setError(
          result.noLiquidity
            ? "The challenge was gone by the time this landed"
            : result.error ?? "Could not take it",
        );
        return;
      }
      await wallet.refresh();
      const against = await coop.crossedWith(
        status.window!.poolAddress,
        wallet.getSnapshot().address!,
      );
      setMaker(against ?? null);
      setPhase("took");
    })();
  }, [challenge, status]);

  const onboarded = gates.onboarded;
  const takeable = phase === "ready" && status?.state === "open";
  const funded = me.collateral > 0n;

  useProgramConsole({
    main: !onboarded
      ? { label: "SET UP", pulse: true, onPress: () => router.push("/") }
      : phase === "took"
        ? { label: "WATCH", pulse: true, onPress: () => router.push("/menu/positions") }
        : {
            label: phase === "taking" ? "…" : "TAKE IT",
            loading: phase === "taking",
            disabled: !takeable || !funded,
            onPress: take,
          },
    status: {
      left: status?.window ? `${status.window.asset} ${Math.max(0, status.secsLeft).toFixed(0)}s` : "CHALLENGE",
      right: `$${wallet.formatCollateral(me.collateral)}`,
    },
    lightShow: phase === "took",
  });

  if (!challenge) {
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Broken link
        </div>
        <p className="px-3 text-center text-[11px] text-text-2">
          This challenge code could not be read.
        </p>
      </ScreenRoot>
    );
  }

  const mySide = challenge.side === "up" ? "DOWN" : "UP";
  const cost = coop.costToAccept(challenge);
  const win = coop.payout(challenge);

  // ── Not onboarded: this is the one thing Demo Mode cannot stand in for ────
  if (!onboarded) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader left="Challenge" right={challenge.handle ? `@${challenge.handle}` : ""} />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          You&apos;d take
        </div>
        <BigNumber value={mySide} tone="brand" />
        <ScreenRow label="Costs up to" value={`$${cost.toFixed(2)}`} />
        <ScreenRow label="To win" value={`$${win.toFixed(2)}`} />
        <p className="px-2 text-center text-[10px] leading-snug text-text-3">
          Taking a challenge is a real trade against their real order — it can&apos;t
          be done in demo. Set up a wallet and it&apos;s yours in one tap.
        </p>
      </ScreenRoot>
    );
  }

  if (phase === "took") {
    const duel =
      maker == null || maker.toLowerCase() === challenge.from.toLowerCase();
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-up">
          {duel ? "Challenge taken" : "Filled"}
        </div>
        <BigNumber value={`$${win.toFixed(2)}`} tone="up" />
        <p className="px-3 text-center text-[10px] leading-snug text-text-3">
          {duel
            ? "to win · settles when the window closes"
            : `to win · someone outbid the challenge, so this crossed ${maker!.slice(0, 6)}…${maker!.slice(-4)} instead`}
        </p>
      </ScreenRoot>
    );
  }

  if (phase === "reading" || !status || status.state === "loading") {
    return (
      <ScreenRoot className="items-center justify-center gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Reading the book
        </div>
        <BigNumber value="…" tone="brand" />
      </ScreenRoot>
    );
  }

  if (status.state !== "open") {
    const headline =
      status.state === "expired"
        ? "Window closed"
        : status.state === "cancelled"
          ? "Pulled"
          : "Already taken";
    const detail =
      status.state === "expired"
        ? "The challenge expired with its window. Nothing was traded."
        : status.state === "cancelled"
          ? "The challenger pulled their order before anyone took it."
          : status.takenBy
            ? `Someone else crossed it — ${status.takenBy.slice(0, 6)}…${status.takenBy.slice(-4)}. A resting order is public.`
            : "Someone else crossed it first. A resting order is public.";
    return (
      <ScreenRoot className="items-center justify-center gap-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-down">
          {headline}
        </div>
        <p className="px-3 text-center text-[11px] leading-snug text-text-2">{detail}</p>
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader
        left={`${status.window?.asset ?? ""} challenge`}
        right={`${Math.max(0, status.secsLeft).toFixed(0)}s`}
      />
      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        {challenge.handle ? `@${challenge.handle} took` : "They took"}{" "}
        {challenge.side === "up" ? "UP" : "DOWN"} · you take
      </div>
      <BigNumber value={mySide} tone="brand" />
      <ScreenRow label="Costs up to" value={`$${cost.toFixed(2)}`} />
      <ScreenRow label="To win" value={`$${win.toFixed(2)}`} />
      <ScreenRow
        label="Challenger"
        value={`${challenge.from.slice(0, 6)}…${challenge.from.slice(-4)}`}
      />
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {error
          ? error
          : !funded
            ? "fund your wallet to take it"
            : status.atFront === false
              ? "someone is bidding better · you would cross them"
              : "mints a pair · no market maker involved"}
      </div>
    </ScreenRoot>
  );
}
