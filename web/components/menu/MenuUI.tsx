"use client";

import Image from "next/image";
import TapTarget from "@/components/ui/TapTarget";

export function MenuSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-3">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white/[.03]">
        {children}
      </div>
    </section>
  );
}

export function MenuRow({
  icon,
  label,
  value,
  href,
  onClick,
  danger,
}: {
  icon?: string;
  label: string;
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <Image
          src={icon}
          alt=""
          width={24}
          height={24}
          className="shrink-0 rounded"
        />
      )}
      <span
        className={`flex-1 text-left text-sm font-bold ${
          danger ? "text-down" : "text-text"
        }`}
      >
        {label}
      </span>
      {value != null && (
        <span className="text-sm font-semibold tabular-nums text-text-2">
          {value}
        </span>
      )}
    </>
  );

  const className =
    "flex w-full items-center gap-3 border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0 transition hover:bg-white/[.04] active:bg-white/[.06]";

  if (href) {
    return (
      <TapTarget href={href} className={className}>
        {body}
      </TapTarget>
    );
  }
  return (
    <TapTarget className={className} onClick={onClick}>
      {body}
    </TapTarget>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down" | "brand";
}) {
  const cls =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "brand"
          ? "text-brand-500"
          : "text-text";
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
        {label}
      </div>
      <div className={`mt-1 text-xl font-black tabular-nums ${cls}`}>
        {value}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-10 text-center text-sm text-text-3">{children}</p>
  );
}
