"use client";

/** Layout primitives for content rendered inside the console screen. */

/**
 * Content inside the screen aperture.
 *
 * The aperture is an **L** — the bottom-right is notched out so the Play key
 * can sit beside the display — and the shell's bevel overhangs its edges. The
 * canvas measures both every frame and publishes them as `--screen-rim` and
 * `--screen-notch`, so this pads by the real inset and reserves the real band
 * the key eats into, at whatever size the device happens to be drawn.
 *
 * It fills the aperture. It used to centre everything vertically inside a
 * percentage-padded box, which left a game's content huddled in the middle of
 * a mostly empty screen. Screens that genuinely are one centred message — a
 * loader, an error, the attract screen — ask for it with `justify-center` in
 * `className`, which still wins because it is applied after this.
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
      className={`flex h-full w-full flex-col text-text ${className}`}
      style={{
        padding: "var(--screen-rim, 18px)",
        paddingBottom:
          "calc(var(--screen-rim, 18px) + var(--screen-notch, 0px))",
      }}
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
    <div className="flex items-center justify-between gap-2 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-text-2">
      <span className="truncate text-brand-500">{left}</span>
      <span className="shrink-0 truncate text-text-3">{right}</span>
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
    <div
      className={`text-center text-[38px] font-extrabold leading-none tabular-nums ${cls}`}
      style={{ textShadow: "0 0 18px currentColor" }}
    >
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
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </span>
      <span className={`text-[15px] font-extrabold tabular-nums ${cls}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * A labelled readout, three across — the reference's LEVERAGE / ASSET / SIDE
 * strip. Small caption, loud value, so a glance lands on the number.
 */
export function StatTile({
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
    <div className="min-w-0 flex-1 border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-3">
        {label}
      </div>
      <div className={`truncate text-[17px] font-extrabold leading-tight tabular-nums ${cls}`}>
        {value}
      </div>
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
