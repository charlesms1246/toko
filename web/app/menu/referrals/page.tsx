"use client";

/**
 * Your share link.
 *
 * The invite count is real, and comes from the one moment we can honestly
 * observe: we pay for every new player's first gas, so the sponsorship route
 * records the code they arrived with. It counts **wallets we funded**, nothing
 * more — there is still no earnings figure, because there are no referral
 * earnings, and inventing one is exactly what this project refuses to do.
 *
 * The link's real teeth are the co-op challenge: an invite that *is* a resting
 * order, so bringing someone in and adding depth to the book are one action.
 */

import Image from "next/image";
import TapTarget from "@/components/ui/TapTarget";
import { MenuRow, MenuSection } from "@/components/menu/MenuUI";
import { useEffect, useState } from "react";
import { useReferral, useUser } from "@/lib/api/hooks";
import { useToast } from "@/components/ui/Toast";
import { explorerAddress } from "@/lib/dreamdex/config";
import * as wallet from "@/lib/dreamdex/wallet";

export default function ReferralsPage() {
  const referral = useReferral();
  const user = useUser();
  const toast = useToast();
  const [invited, setInvited] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void wallet.invitedCount(referral.handle).then((n) => {
      if (!cancelled) setInvited(n);
    });
    return () => {
      cancelled = true;
    };
  }, [referral.handle]);

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
        <div className="mt-3 text-3xl font-black tabular-nums text-brand-500">
          {invited ?? "—"}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-text-3">
          {invited === null
            ? "Share your link. Anyone who opens it lands on the console."
            : `${invited === 1 ? "player" : "players"} you brought in — counted when we funded their first wallet`}
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
