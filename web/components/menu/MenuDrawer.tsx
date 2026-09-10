"use client";

/**
 * The menu is a drawer over the console, not screen content — the console
 * screen is far too small for stats and history. Pages under /menu render here
 * through a portal, while the console itself drops into a MENU idle state.
 */

import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import TapTarget from "@/components/ui/TapTarget";
import { ScreenRoot } from "@/components/screen/Screen";
import { useProgramConsole } from "@/lib/console/controls";
import { useBalance } from "@/lib/api/hooks";
import { formatCollateral } from "@/lib/dreamdex/wallet";
import { useIsMounted } from "@/lib/react/hooks";
import * as demo from "@/lib/demo";
import { useSyncExternalStore } from "react";
import NeedsWallet from "@/components/menu/NeedsWallet";

/**
 * Screens that read the player's own chain state. In Demo Mode there is no
 * wallet behind them, so they say what they need rather than showing an empty
 * list that looks like a real record of nothing.
 *
 * Everything else stays open: live windows and the duel board are real market
 * data, and the leaderboard is built from the venue's trades, not the player's.
 */
const NEEDS_WALLET = [
  "/menu/wallet",
  "/menu/withdraw",
  "/menu/transactions",
  "/menu/positions",
  "/menu/history",
  "/menu/achievements",
  "/menu/share",
];

export default function MenuDrawer({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useIsMounted();
  const router = useRouter();
  const pathname = usePathname();
  const balance = useBalance();
  const isHub = pathname === "/menu";
  // The customizer is the one screen whose subject is the console itself, so it
  // docks to the bottom over a live view of it rather than covering it — which
  // is exactly what the reference does.
  const overConsole = pathname === "/menu/customize";
  const { active: demoing } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );
  const blocked = demoing && NEEDS_WALLET.includes(pathname);

  useProgramConsole({
    status: { left: "MENU", right: `$${formatCollateral(balance)}` },
  });

  const drawer = (
    <div
      className={`fixed z-[45] flex justify-center overflow-hidden ${
        overConsole ? "items-end" : "bg-black/80 backdrop-blur-md"
      }`}
      style={{
        // Seated in the SCREEN, not on the whole device. It is portalled to
        // <body> to escape the screen's own clipping, so it takes the aperture's
        // projected rect from the canvas instead of filling the viewport —
        // otherwise the menu is the one part of the app that is not a console.
        //
        // It used to inset to `--device-*`, which is the entire hardware
        // bounding box, so opening the menu covered the keys and the chin and
        // the console disappeared. The glass is the part a menu belongs in.
        left: "var(--screen-left, 0px)",
        right: "var(--screen-right, 0px)",
        top: "var(--screen-top, 0px)",
        bottom: "var(--screen-bottom, 0px)",
        borderRadius: "clamp(12px, 3.5vw, 26px)",
      }}
    >
      {/* No `max-w-*`: the panel is as wide as the glass. A fixed 448px inside a
          variable-width aperture left the menu floating with blurred console
          down both sides on a desktop, and filling it exactly on a phone — the
          same screen composed two different ways for no reason the player can
          see. */}
      <div
        className={`flex w-full flex-col ${
          overConsole
            ? "max-h-[82%] bg-gradient-to-t from-black via-black/96 to-transparent pt-6"
            : "h-full bg-[#0d0d0f]"
        }`}
        style={{ animation: "drawer-rise .3s var(--ease-out-expo) both" }}
      >
        <header
          className={`flex items-center justify-between px-3 py-3 ${
            overConsole ? "" : "border-b border-[var(--color-line)]"
          }`}
        >
          {isHub ? (
            <span className="w-9" />
          ) : (
            <TapTarget
              className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-white/5"
              onClick={() => router.push("/menu")}
              aria-label="Back to menu"
            >
              <ChevronLeft size={20} />
            </TapTarget>
          )}
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-3">
            {isHub ? "Menu" : pathname.split("/").pop()?.replace(/-/g, " ")}
          </span>
          <TapTarget
            className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-white/5"
            onClick={() => router.push("/games")}
            aria-label="Close menu"
          >
            <X size={20} />
          </TapTarget>
        </header>

        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-4">
          {blocked ? <NeedsWallet /> : children}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* The console keeps rendering behind the drawer. */}
      <ScreenRoot className="items-center justify-center">
        {!overConsole && (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
            Menu open
          </span>
        )}
      </ScreenRoot>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
