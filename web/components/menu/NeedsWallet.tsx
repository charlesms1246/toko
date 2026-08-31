"use client";

/**
 * What a demo player sees on a screen that has nothing to show them.
 *
 * Some things genuinely cannot be demoed — anything that reads the player's own
 * chain state, or that needs a real counterparty. Showing an empty list would
 * read as "you have no history" rather than "you have no wallet", so these say
 * plainly what is missing and offer the one tap that fixes it.
 */

import { useRouter } from "next/navigation";
import TapTarget from "@/components/ui/TapTarget";
import * as demo from "@/lib/demo";

export default function NeedsWallet({ what }: { what?: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto mt-10 max-w-xs text-center">
      <p className="text-sm font-bold">Needs a wallet</p>
      <p className="mt-2 text-[12px] leading-relaxed text-text-3">
        {what ?? "This reads your own on-chain record"}, and in demo there is no
        wallet behind it. Everything else — live windows, real prices, real
        settlement — you already have.
      </p>
      <TapTarget
        className="mt-6 w-full rounded-full bg-brand-500 px-6 py-3.5 text-sm font-extrabold text-black"
        haptic="high"
        onClick={() => {
          demo.end();
          router.push("/");
        }}
      >
        Set up a wallet
      </TapTarget>
      <p className="mt-3 text-[11px] text-text-3">
        Gas is on us. Takes a few seconds.
      </p>
    </div>
  );
}
