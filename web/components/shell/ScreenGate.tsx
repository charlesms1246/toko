"use client";

/**
 * What the console's SCREEN shows before there is anything behind it.
 *
 * This sits inside `ConsoleStage`, not around it, which matters: the gate swaps
 * the route's screen content, never the device. Wrapping the stage instead took
 * the whole console off the page.
 *
 * Without a wallet or a paper ledger the console cannot play, so it must not
 * look as though it can. A signed-out visitor who reached `/games/lucky` used to
 * get a live game behind the landing copy — real prices, a running countdown, lit
 * LONG and SHORT keys, and "FUND YOUR WALLET" where the cost belongs.
 */

import { useSyncExternalStore } from "react";
import * as onboarding from "@/lib/onboarding";
import * as demo from "@/lib/demo";
import AttractScreen from "./AttractScreen";

export default function ScreenGate({ children }: { children: React.ReactNode }) {
  const { onboarded } = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );
  const { active: demoing } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );

  return onboarded || demoing ? <>{children}</> : <AttractScreen />;
}
