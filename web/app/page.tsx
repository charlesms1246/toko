"use client";

/**
 * The index route. There is no page here in the usual sense — the console *is*
 * the page, and this just puts it into attract mode.
 */

import { useRouter } from "next/navigation";
import { useProgramConsole } from "@/lib/console/controls";
import { ScreenRoot } from "@/components/screen/Screen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import { resumeAudio } from "@/lib/sound";

export default function AttractScreen() {
  const router = useRouter();
  const btc = useSpot("BTC");

  useProgramConsole({
    main: {
      label: "START",
      pulse: true,
      onPress: () => {
        resumeAudio();
        router.push("/games");
      },
    },
  });

  return (
    <ScreenRoot className="items-center justify-center gap-4">
      <div
        className="text-center font-display text-2xl font-bold tracking-[0.18em] text-brand-500"
        style={{
          textShadow:
            "0 0 6px rgba(255,157,18,.9), 0 0 18px rgba(255,157,18,.55), 0 0 40px rgba(255,157,18,.3)",
          animation: "viz-pulse 1.8s ease-in-out infinite",
        }}
      >
        PRESS START
      </div>

      <div className="flex items-baseline gap-2 text-text-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
          BTC
        </span>
        <span className="text-sm font-bold tabular-nums text-text-2">
          ${formatPrice(btc)}
        </span>
      </div>
    </ScreenRoot>
  );
}
