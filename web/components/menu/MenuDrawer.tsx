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
  // Account was missed on the first pass and is the same case as the rest: it
  // reads the chain record (plays, win rate, net P&L, volume, streak, best
  // multiple), prints the real wallet address and network, and says "Signed in
  // with Embedded wallet". In demo none of that is true of the person reading
  // it — the figures are a real wallet's, all zero, shown to somebody who has
  // been playing on paper and therefore has a record that is not zero.
  "/menu/account",
  // Referrals is wallet-scoped too, and in demo it renders as a dead page: the
  // handle comes out empty ("@ —") and the "link" is the bare site root with no
  // referral code in it, behind a Copy button. A share affordance that copies
  // something which refers nobody is worse than saying a wallet is needed.
  "/menu/referrals",
];

export default function MenuDrawer({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useIsMounted();
  const router = useRouter();
  const pathname = usePathname();
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
  });

  const drawer = (
    <div
      className={`fixed z-[45] flex items-end justify-center overflow-hidden ${
        overConsole ? "" : "bg-black/55 backdrop-blur-sm"
      }`}
      style={{
        // A sheet IN FRONT OF the device, not a panel inside its glass.
        //
        // The menu is not console content — it is the app's own surface, and the
        // reference presents it the same way: a bottom sheet over a blurred
        // console, with a drag handle, running to the bottom edge. Anchoring it
        // to the aperture instead put it *inside* the screen, which left the
        // Play key poking into a corner of the list and made the menu look like
        // something the device was displaying rather than something laid over
        // it. The device rect is the right frame; the glass is not.
        // The customizer is the exception: the console shrinks to make room for
        // its sheet, so a sheet measured off the device would shrink with it and
        // then shrink the device again. It takes the viewport instead.
        left: overConsole ? 0 : "var(--device-left, 0px)",
        right: overConsole ? 0 : "var(--device-right, 0px)",
        top: overConsole ? 0 : "var(--device-top, 0px)",
        bottom: overConsole ? 0 : "var(--device-bottom, 0px)",
        borderRadius: overConsole ? 0 : "clamp(12px, 3.5vw, 26px)",
      }}
    >
      {/* No `max-w-*`: the sheet is as wide as the device. A fixed 448px inside
          a variable-width frame left it floating with blurred console down both
          sides on a desktop and filling the frame exactly on a phone — the same
          screen composed two different ways for no reason a player can see.

          `max-h-[92%]` rather than the full height, so a band of the console
          stays visible above it. That sliver is what says "this is over the
          device", and it is what the reference shows above its own sheet. */}
      <div
        className={`flex w-full flex-col ${
          overConsole
            ? "max-h-[46%] max-w-md bg-gradient-to-t from-black via-black/96 to-transparent pt-6"
            : "max-h-[92%] rounded-t-[18px] bg-[#0d0d0f]"
        }`}
        style={{ animation: "drawer-rise .3s var(--ease-out-expo) both" }}
      >
        {/* The grab handle. It is not draggable — the sheet is dismissed by the
            close key or the MENU pill — but it is the one mark that reads
            "sheet" at a glance, and the reference's carries the same. */}
        {!overConsole && (
          <span
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-white/25"
          />
        )}
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
      {/* Into the app COLUMN, not the body.
          The frame is a containing block for `position: fixed`, and the
          console publishes its `--device-*` rect in frame coordinates — a
          16px inset each side. Portalled to `document.body` the sheet sat
          outside the frame, so those insets were measured against the whole
          viewport and the menu spread across the desk while the console it is
          supposed to cover stayed 460px wide. */}
      {mounted &&
        createPortal(drawer, document.querySelector(".app-frame") ?? document.body)}
    </>
  );
}
