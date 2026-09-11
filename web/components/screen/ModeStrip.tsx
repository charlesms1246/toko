"use client";

/**
 * The mode row, at the top of the glass.
 *
 * Rule 0.5 requires Demo Mode to be labelled at all times, and it used to be —
 * by a pill floating above the console, outside the device entirely. That read
 * as browser chrome stuck to the page rather than as something the machine was
 * telling you, and it sat over the shell wherever the device happened to be
 * drawn. The reference puts the same information inside the screen, on a row of
 * its own at the top: a state on the left, a second reading on the right.
 *
 * It doubles as the way out of demo, because the honest moment to offer a real
 * wallet is while somebody is looking at a number that is not real.
 */

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import * as demo from "@/lib/demo";

export default function ModeStrip({ right }: { right?: React.ReactNode }) {
  const router = useRouter();
  const [held, setHeld] = useState(false);
  const { active } = useSyncExternalStore(
    demo.subscribe,
    demo.getSnapshot,
    demo.getServerSnapshot,
  );

  /**
   * Paper positions still on the books.
   *
   * Leaving demo throws the ledger away, so the player is owed this number
   * before they decide. It used to be an outright refusal — press "go real"
   * with anything open and the button just changed to "finish your round" —
   * which was a trap, because a demo position is ONLY cleared by the game
   * screen that opened it. Leave a round mid-window and the entry never
   * clears, `hasOpenPlay` stays true for good, and there is no way back to real
   * play short of wiping site data. A paper position is not money; discarding
   * it costs nothing real, so the honest design is to say what is being
   * discarded and let the player choose.
   */
  const open = active ? demo.openCount() : 0;

  return (
    <div className="relative flex shrink-0 items-center justify-between gap-3 px-[var(--screen-rim,24px)] pt-[var(--screen-rim,24px)] pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
      <span className="flex min-w-0 items-center gap-2 text-text-2">
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span
            className={`absolute inset-0 animate-ping ${
              active ? "bg-brand-500/70" : "bg-up/70"
            }`}
          />
          <span
            className={`relative inline-block h-2 w-2 ${
              active ? "bg-brand-500" : "bg-up"
            }`}
          />
        </span>
        <span className="truncate">
          {active ? "Demo · fills are pretend" : "Live"}
        </span>
      </span>

      {active ? (
        <button
          type="button"
          onClick={() => {
            if (open > 0) {
              setHeld(true);
              return;
            }
            demo.end();
            router.push("/");
          }}
          className="shrink-0 whitespace-nowrap font-extrabold tracking-[0.12em] text-brand-500"
        >
          go real
        </button>
      ) : (
        right != null && (
          <span className="shrink-0 whitespace-nowrap text-text-3">{right}</span>
        )
      )}

      {held && (
        <div className="absolute inset-x-0 top-full z-30 mx-[var(--screen-rim,24px)] mt-1 border border-brand-500/50 bg-black/95 p-3 text-left normal-case tracking-normal">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-brand-500">
            Going real
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-snug text-text-2">
            You have {open} paper {open === 1 ? "position" : "positions"} open.
            Leaving demo throws the paper ledger away — none of it is real money,
            and nothing on chain changes.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setHeld(false)}
              className="flex-1 border border-[var(--color-line-strong)] py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-2"
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={() => {
                demo.end();
                router.push("/");
              }}
              className="flex-[1.4] bg-brand-500 py-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-black"
            >
              Set up a wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
