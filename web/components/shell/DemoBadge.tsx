"use client";

/**
 * The label Demo Mode must always carry.
 *
 * Rule 0.5 allows exactly one hypothetical thing in this app, on condition that
 * it never passes for the real one. So this sits above every screen for as long
 * as the mode is on — not on a settings page, not in a tooltip — and it doubles
 * as the way out, because the honest moment to offer a real wallet is while
 * someone is looking at a number that is not.
 */

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import * as demo from "@/lib/demo";

export default function DemoBadge() {
  const router = useRouter();
  const { active, ledger } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );
  if (!active) return null;

  // Once a round has actually settled, the invitation can be specific about
  // what it is offering instead of generic.
  const settled = ledger.rounds > 0;

  return (
    <button
      type="button"
      onClick={() => {
        demo.end();
        router.push("/");
      }}
      className="fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-full border border-[var(--color-premium-500)] bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-premium-500)] backdrop-blur"
    >
      Demo · fills are pretend
      <span className="ml-2 font-extrabold text-brand-500">
        {settled ? `${ledger.rounds} played — go real` : "go real"}
      </span>
    </button>
  );
}
