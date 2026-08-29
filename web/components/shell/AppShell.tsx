"use client";

/**
 * Everything that layers over the console: the ordered onboarding gates, the
 * cross-page active-play pill, the onboarding tour, and the settle toasts.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "./Onboarding";
import Tour from "./Tour";
import { resumeAudio } from "@/lib/sound";
import * as onboarding from "@/lib/onboarding";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { onboarded, tourSeen } = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );

  useEffect(() => {
    onboarding.hydrate();
  }, []);

  const finishOnboarding = useCallback(() => {
    onboarding.completeOnboarding();
    resumeAudio();
    router.push("/games");
  }, [router]);


  return (
    <>
      {children}
      {!onboarded && <Onboarding onDone={finishOnboarding} />}
      {onboarded && !tourSeen && <Tour onDone={onboarding.completeTour} />}
    </>
  );
}
