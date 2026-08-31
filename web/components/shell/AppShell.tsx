"use client";

/**
 * Everything that layers over the console: the ordered onboarding gates, the
 * Demo Mode label, the onboarding tour, and the settle toasts.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "./Onboarding";
import Tour from "./Tour";
import DemoBadge from "./DemoBadge";
import { resumeAudio } from "@/lib/sound";
import * as onboarding from "@/lib/onboarding";
import * as demo from "@/lib/demo";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { onboarded, tourSeen } = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );
  const { active: demoing } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );

  useEffect(() => {
    onboarding.hydrate();
    demo.hydrate();
  }, []);

  const finishOnboarding = useCallback(() => {
    // A funded wallet and a paper ledger must never be live together.
    demo.end();
    // The demo summary has done its job on the funding screen by now.
    demo.clearPastRun();
    onboarding.completeOnboarding();
    resumeAudio();
    router.push("/games");
  }, [router]);

  /** Try it before signing up: the console is real, only the fills are not. */
  const startDemo = useCallback(() => {
    demo.start();
    resumeAudio();
    router.push("/games");
  }, [router]);


  return (
    <>
      {children}
      <DemoBadge />
      {!onboarded && !demoing && (
        <Onboarding onDone={finishOnboarding} onDemo={startDemo} />
      )}
      {(onboarded || demoing) && !tourSeen && (
        <Tour onDone={onboarding.completeTour} />
      )}
    </>
  );
}
