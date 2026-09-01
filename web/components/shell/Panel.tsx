"use client";

/**
 * A full-height panel layered over the console.
 *
 * The console screen is too small for tables and dashboards, so /menu, /admin
 * and /dev render here through a portal while the console drops into an idle
 * state behind them.
 */

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import TapTarget from "@/components/ui/TapTarget";
import { ScreenRoot } from "@/components/screen/Screen";
import { useProgramConsole } from "@/lib/console/controls";
import { useIsMounted } from "@/lib/react/hooks";

export default function Panel({
  title,
  backHref,
  closeHref = "/games",
  screenLabel,
  status,
  wide,
  children,
}: {
  title: string;
  /** Omit to hide the back chevron. */
  backHref?: string;
  closeHref?: string;
  /** What the console screen shows while this panel is open. */
  screenLabel: string;
  status?: { left?: string; right?: string };
  /**
   * Break out of the phone-width column. For the dev tools, which are internal
   * reference pages rather than part of the product surface — a catalogue is
   * no use as a single narrow column on a desktop.
   */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const mounted = useIsMounted();
  const router = useRouter();

  useProgramConsole({ status: status ?? { left: screenLabel } });

  const panel = (
    <div className="fixed inset-0 z-[45] flex justify-center bg-black/80 backdrop-blur-md">
      <div
        className={`flex h-full w-full flex-col border-x border-[var(--color-line)] bg-[#0d0d0f] ${
          wide ? "max-w-[1400px]" : "max-w-md"
        }`}
        style={{ animation: "drawer-rise .3s var(--ease-out-expo) both" }}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-3">
          {backHref ? (
            <TapTarget
              className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-white/5"
              onClick={() => router.push(backHref)}
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </TapTarget>
          ) : (
            <span className="w-9" />
          )}
          <span className="truncate text-xs font-bold uppercase tracking-[0.2em] text-text-3">
            {title}
          </span>
          <TapTarget
            className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-white/5"
            onClick={() => router.push(closeHref)}
            aria-label="Close"
          >
            <X size={20} />
          </TapTarget>
        </header>

        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-4">
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ScreenRoot className="items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {screenLabel}
        </span>
      </ScreenRoot>
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
