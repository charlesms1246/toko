"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useStoreHydrated } from "@/lib/api/hooks";

/**
 * The lab games are admin-only. Non-admins are bounced back to the picker, the
 * same way the original gate behaves.
 */
export function useRequireAdmin(): boolean {
  const router = useRouter();
  const admin = useIsAdmin();
  // Persisted state is read in an effect, so `admin` is false for the first
  // client render. Redirecting before that lands would bounce real admins off
  // their own pages on a refresh.
  const ready = useStoreHydrated();

  useEffect(() => {
    if (ready && !admin) router.replace("/games");
  }, [ready, admin, router]);

  return admin;
}
