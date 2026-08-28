"use client";

import { useState } from "react";
import TapTarget from "@/components/ui/TapTarget";
import { useStoreActions, useUser } from "@/lib/api/hooks";
import { useToast } from "@/components/ui/Toast";

export default function UsernamePage() {
  const user = useUser();
  const actions = useStoreActions();
  const toast = useToast();
  const [handle, setHandle] = useState(user.username);

  const valid = handle.length >= 3 && handle.length <= 20;

  return (
    <>
      <h1 className="text-xl font-extrabold tracking-tight">Pick your handle</h1>
      <p className="mt-1 text-sm text-text-2">
        3–20 characters. Letters, numbers and underscores.
      </p>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[var(--color-line-strong)] bg-white/5 px-4 py-3">
        <span className="text-lg font-bold text-text-3">@</span>
        <input
          value={handle}
          onChange={(e) =>
            setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))
          }
          className="w-full bg-transparent text-lg font-bold outline-none"
        />
      </div>

      <TapTarget
        className="mt-5 w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"
        disabled={!valid}
        haptic="high"
        onClick={() => {
          actions.setUsername(handle);
          toast("Handle updated", "win");
        }}
      >
        Save
      </TapTarget>
    </>
  );
}
