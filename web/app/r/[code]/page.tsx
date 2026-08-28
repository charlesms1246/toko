"use client";

/** Referral code landing. Stores the code, then drops you into the games. */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScreenRoot } from "@/components/screen/Screen";
import { useProgramConsole } from "@/lib/console/controls";

export const REF_KEY = "toko_ref";

export default function ReferralCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  useEffect(() => {
    try {
      window.localStorage.setItem(REF_KEY, code);
    } catch {
      // not persisted — the referral just won't be attributed
    }
    const timer = setTimeout(() => router.replace("/games"), 1200);
    return () => clearTimeout(timer);
  }, [code, router]);

  useProgramConsole({ status: { left: "REFERRAL", right: code.toUpperCase() } });

  return (
    <ScreenRoot className="items-center gap-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Invited with
      </div>
      <div className="text-lg font-black text-brand-500">{code}</div>
      <div className="text-[11px] text-text-2">Setting you up…</div>
    </ScreenRoot>
  );
}
