"use client";

import { ScreenRoot } from "@/components/screen/Screen";

/** Shown while the admin gate decides whether to bounce you. */
export function LabGate() {
  return (
    <ScreenRoot className="items-center justify-center">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Lab access only
      </span>
    </ScreenRoot>
  );
}
