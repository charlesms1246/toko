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
    <section className="mb-6 flex flex-col gap-1.5">
      {title && (
        <h2 className="mb-0.5 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">
          {title}
        </h2>
      )}
      {children}
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
  external,
}: {
  icon?: string;
  label: string;
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  /** Open in a new tab — for faucets and the block explorer. */
  external?: boolean;
}) {
  const body = (
    <>
      {icon ? (
        <Image
          src={icon}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 object-contain"
        />
      ) : null}
      <span
        className={`flex-1 text-left text-[17px] font-bold ${
          danger ? "text-down" : "text-text"
        }`}
      >
        {label}
      </span>
      {value != null ? (
        <span className="tnum text-[15px] font-bold text-text-2">{value}</span>
      ) : (
        <span className="text-2xl text-text-3">›</span>
      )}
    </>
  );

  // Each row is its own raised card, the way the reference's menu reads —
  // a stack of objects rather than a boxed list.
  const className =
    "surface-skeuo rounded-card flex w-full items-center gap-3 p-4 text-left transition-transform active:scale-[0.99]";

  if (href) {
    return (
      <TapTarget
        href={href}
        className={className}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
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
