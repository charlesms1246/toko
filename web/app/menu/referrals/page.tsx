"use client";

import { StatTile } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import { useReferral } from "@/lib/api/hooks";
import { claimReferral } from "@/lib/api/store";
import { useToast } from "@/components/ui/Toast";

export default function ReferralsPage() {
  const referral = useReferral();
  const toast = useToast();
  const claimable = Number(referral.claimable);

  return (
    <>
      <p className="mb-5 px-1 text-sm leading-relaxed text-text-2">
        Share your link. When someone you invited plays, you earn a cut of the
        house edge on every play they make.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <StatTile label="Invited" value={String(referral.invited)} />
        <StatTile label="Earned" value={`$${referral.earned}`} tone="up" />
        <StatTile
          label="Claimable"
          value={`$${referral.claimable}`}
          tone="brand"
        />
      </div>

      <div className="mb-3 rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          Your link
        </div>
        <div className="mt-1 break-all font-mono text-sm text-text">
          {referral.url}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <TapTarget
          className="flex-1 rounded-full border border-[var(--color-line-strong)] py-3 text-sm font-bold text-text-2"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(referral.url)
              .then(() => toast("Link copied"))
              .catch(() => toast("Couldn't copy that link.", "lose"));
          }}
        >
          Copy link
        </TapTarget>
        <TapTarget
          className="flex-1 rounded-full border border-[var(--color-line-strong)] py-3 text-sm font-bold text-text-2"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(referral.code)
              .then(() => toast("Code copied"))
              .catch(() => toast("Couldn't copy that code.", "lose"));
          }}
        >
          Copy code
        </TapTarget>
      </div>

      <TapTarget
        className="w-full rounded-full bg-brand-500 py-3.5 text-sm font-extrabold text-black disabled:opacity-40"
        disabled={claimable <= 0}
        haptic="high"
        onClick={() => {
          const result = claimReferral();
          if (result.ok) toast(`Claimed $${result.amount}`, "win");
        }}
      >
        Claim ${referral.claimable}
      </TapTarget>
    </>
  );
}
