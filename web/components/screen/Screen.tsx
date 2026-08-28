"use client";

/** Layout primitives for content rendered inside the console screen. */

/**
 * Content inside the screen aperture.
 *
 * The projected rect is the bounding box of the screen cutout, but the shell's
 * bevel overhangs it slightly and the Play key sits in the bottom-right notch —
 * so the padding is proportional (it has to hold at any device size) and
 * content is centred vertically to stay clear of both.
 */
export function ScreenRoot({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full w-full flex-col justify-center text-text ${className}`}
      style={{ padding: "5% 6%" }}
    >
      {children}
    </div>
  );
}

export function ScreenHeader({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
      <span className="truncate">{left}</span>
      <span className="truncate">{right}</span>
    </div>
  );
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-lg font-extrabold tracking-tight text-text">
      {children}
    </div>
  );
}

export function BigNumber({
  value,
  tone = "neutral",
}: {
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
    <div className={`text-center text-3xl font-black tabular-nums ${cls}`}>
      {value}
    </div>
  );
}

export function ScreenRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
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
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-text-3">
        {label}
      </span>
      <span className={`font-bold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

/** Thin progress bar used for countdowns. */
export function ScreenBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-linear"
        style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
      />
    </div>
  );
}
