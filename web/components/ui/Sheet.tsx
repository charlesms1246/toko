"use client";

import { useEffect, useState } from "react";
import { playSfx } from "@/lib/sound";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Fills the viewport instead of hugging its content. */
  full?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bottom sheet with a scrim, rise/fall animation and an escape hatch. */
export default function Sheet({
  open,
  onClose,
  title,
  full = false,
  children,
  footer,
}: SheetProps) {
  // The sheet has to outlive `open` long enough to play its exit animation, so
  // it stays rendered until the fall animation reports that it finished.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{
          animation: `${open ? "scrim-in .24s" : "scrim-out .18s"} ease both`,
        }}
        onClick={() => {
          playSfx("swipe");
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-md overflow-hidden rounded-t-3xl border border-b-0 border-[var(--color-line-strong)] bg-[#141416] ${
          full ? "h-[92vh]" : "max-h-[86vh]"
        } flex flex-col`}
        style={{
          animation: open
            ? "drawer-rise .34s var(--ease-out-expo) both"
            : "drawer-fall .22s var(--ease-out-quart) both",
        }}
        onAnimationEnd={() => {
          if (!open) setRendered(false);
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        {title && (
          <h2 className="px-5 pb-2 text-lg font-extrabold tracking-tight">
            {title}
          </h2>
        )}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5">
          {children}
        </div>
        {footer && (
          <div className="border-t border-[var(--color-line)] p-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
