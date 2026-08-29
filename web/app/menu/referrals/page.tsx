"use client";

/**
 * Your share link.
 *
 * There is deliberately no invite count or earnings figure here. Attribution
 * would need an indexer keyed on the referral code, and there isn't one — so
 * the numbers would be invented, which is exactly what the project forbids.
 *
 * The link itself is real, and the co-op challenge in Phase 8 is the mechanic
 * that gives it teeth: an invite that *is* a resting order, so bringing someone
 * in and adding depth to the book are the same action.
 */

import Image from "next/image";
import TapTarget from "@/components/ui/TapTarget";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { useReferral, useUser } from "@/lib/api/hooks";
import { useToast } from "@/components/ui/Toast";
import { explorerAddress } from "@/lib/dreamdex/config";

export default function ReferralsPage() {
  const referral = useReferral();
  const user = useUser();
  const toast = useToast();

  const copy = (text: string, what: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => toast(`${what} copied`, "win"))
      .catch(() => toast("Couldn't copy that.", "lose"));
  };

  return (
    <>
      <div className="mb-6 flex flex-col items-center rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-6 text-center">
        <Image
          src="/assets/icons/icon-referrals.webp"
          alt=""
          width={64}
          height={64}
        />
        <div className="mt-3 text-lg font-black tracking-tight">
          @{referral.handle}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-text-3">
          Share your link. Anyone who opens it lands on the console.
        </p>
      </div>

      <MenuSection title="Link">
        <button
          type="button"
          className="w-full border-b border-[var(--color-line)] px-4 py-3.5 text-left last:border-b-0"
          onClick={() => copy(referral.url, "Link")}
        >
          <span className="break-all font-mono text-xs text-text-2">
            {referral.url}
          </span>
        </button>
        {user.address && (
          <MenuRow
            label="Your address"
            value="↗"
            href={explorerAddress(user.address)}
            external
          />
        )}
      </MenuSection>

      <TapTarget
        className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black"
        haptic="high"
        onClick={() => copy(referral.url, "Link")}
      >
        Copy your link
      </TapTarget>
    </>
  );
}
