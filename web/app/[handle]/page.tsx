"use client";

/**
 * Vanity referral landing — `/@someone`.
 *
 * A folder literally named `@handle` would be read as a parallel-route slot, so
 * this is a plain dynamic segment that only accepts values starting with `@`
 * and 404s otherwise. Static routes still win over it.
 */

import { use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { ScreenRoot } from "@/components/screen/Screen";
import { REF_KEY } from "@/app/r/[code]/page";

export default function HandlePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const router = useRouter();
  const decoded = decodeURIComponent(handle);
  const valid = decoded.startsWith("@") && decoded.length > 1;
  const username = valid ? decoded.slice(1) : "";

  useEffect(() => {
    if (!valid) return;
    try {
      window.localStorage.setItem(REF_KEY, username);
    } catch {
      // not persisted — the referral just won't be attributed
    }
    const timer = setTimeout(() => router.replace("/games"), 1200);
    return () => clearTimeout(timer);
  }, [valid, username, router]);

  if (!valid) notFound();

  return (
    <ScreenRoot className="items-center gap-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Invited by
      </div>
      <div className="text-lg font-black text-brand-500">@{username}</div>
      <div className="text-[11px] text-text-2">Setting you up…</div>
    </ScreenRoot>
  );
}
