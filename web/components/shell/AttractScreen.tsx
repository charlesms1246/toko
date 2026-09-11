"use client";

/**
 * What the console shows before there is anything behind it.
 *
 * A display, not an instrument. Every key is unprogrammed, so the hardware dims
 * itself and nothing on the glass invites a press — which is the point: until a
 * visitor has a wallet or a paper ledger, the console cannot play, and it should
 * not look like it can.
 *
 * The spot price is the one live thing here, and it earns its place: it is the
 * asset the whole product trades, it is real, and it is the quickest way to show
 * the machine is plugged into something.
 */

import Image from "next/image";
import { useProgramConsole } from "@/lib/console/controls";
import { ScreenRoot } from "@/components/screen/Screen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";

export default function AttractScreen() {
  const btc = useSpot("BTC");

  // No main key, no action keys, no dials. The console is idle hardware.
  useProgramConsole({});

  return (
    <ScreenRoot className="items-center justify-center gap-3">
      <Image
        src="/assets/logos/toko-mark.svg"
        alt="TOKO"
        width={96}
        height={96}
        unoptimized
        className="h-14 w-auto opacity-95"
        priority
      />

      {/* The arcade line, not the marketing tagline — the pitch below the device
          already carries that, and saying it twice on one page reads as a
          mistake. This is what an idle machine says. */}
      <div
        className="font-display text-xl font-bold tracking-[0.18em] text-brand-500"
        style={{
          textShadow:
            "0 0 6px rgba(255,157,18,.9), 0 0 18px rgba(255,157,18,.55), 0 0 40px rgba(255,157,18,.3)",
          animation: "viz-pulse 1.8s ease-in-out infinite",
        }}
      >
        PRESS START
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          BTC
        </span>
        <span className="tnum text-sm font-bold text-text-2">
          {btc > 0 ? `$${formatPrice(btc)}` : "—"}
        </span>
      </div>
    </ScreenRoot>
  );
}
