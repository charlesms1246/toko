"use client";

/**
 * Frame export harness. Renders the console offscreen at card resolution and
 * pulls a PNG out of the canvas, the way the P&L share card does.
 */

import { useRef, useState } from "react";
import ConsoleCanvas from "@/components/console/ConsoleCanvas";
import { MenuSection } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import { useConsoleTheme } from "@/lib/console/theme-context";
import { useToast } from "@/components/ui/Toast";

export default function DevExportPage() {
  const { resolved } = useConsoleTheme();
  const stageRef = useRef<HTMLDivElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const toast = useToast();

  const capture = () => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) {
      toast("No canvas to capture yet.", "lose");
      return;
    }
    try {
      // The renderer clears its drawing buffer after each frame, so read it
      // back immediately rather than on a later tick.
      setDataUrl(canvas.toDataURL("image/png"));
      toast("Frame captured", "win");
    } catch {
      toast("Capture failed — the canvas is tainted.", "lose");
    }
  };

  return (
    <>
      <div
        ref={stageRef}
        className="relative mb-4 aspect-[836/1492] w-full overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[#08080a]"
      >
        <ConsoleCanvas theme={resolved} exportMode />
      </div>

      <TapTarget
        className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black"
        onClick={capture}
      >
        Capture frame
      </TapTarget>

      {dataUrl && (
        <MenuSection title="Captured">
          <div className="p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="Captured console frame"
              className="w-full rounded-xl"
            />
          </div>
        </MenuSection>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-text-3">
        The shipped app renders this offscreen at 836×1492 with a fixed pose,
        waits for the first non-transparent frame, and caches the result in
        IndexedDB under <code>toko-cards</code>.
      </p>
    </>
  );
}
