"use client";

/**
 * The in-console screen kit, ported 1:1 from the reference build's shared
 * `screen-*` chunk — same elements, same class strings, same nesting.
 *
 * Its rule for this surface: **flat, sparse, high contrast**, against an app
 * surface that stays glossy and calm. Everything here is black ground, mono
 * capitals, and one loud number per screen.
 *
 * The copy is ours, because the copy describes our venue rather than theirs.
 * The chrome is theirs.
 */

import ModeStrip from "./ModeStrip";

/** The screen's ground. Every game screen's outermost element. */
export function Shell({
  children,
  mode,
}: {
  children: React.ReactNode;
  /** Right-hand reading on the mode row. Ignored in demo, which needs the exit. */
  mode?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-text">
      <ModeStrip right={mode} />
      {children}
    </div>
  );
}

/**
 * The body, with an optional pinned top slot. The slot is
 * `pointer-events-none` and sits over the content rather than pushing it, so a
 * chart can run full-bleed underneath a header.
 */
export function Body({
  top,
  children,
}: {
  top?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-0 flex-1">
      {children}
      {top != null && (
        <div className="pointer-events-none absolute inset-x-0 top-0 p-[var(--screen-rim,24px)]">
          {top}
        </div>
      )}
    </div>
  );
}

/** The stack that lives in the top slot. Capped at 62% so it clears a gauge. */
export function TopStack({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none max-w-[62%] space-y-2.5 p-[var(--screen-rim,24px)]">
      {children}
    </div>
  );
}

/** Glass: a cool wash, scanlines and a vignette. Always on, never interactive. */
export function Fx() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background:
            "radial-gradient(120% 95% at 50% 40%, rgba(130,165,205,0.11), transparent 60%)",
        }}
      />
      <div className="viz-scanlines absolute inset-0" />
      <div className="viz-vignette absolute inset-0" />
    </div>
  );
}

/** A labelled readout — the kit's smallest unit. */
export function Readout({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </div>
      <div className="tnum text-base font-bold leading-tight text-text">
        {value}
      </div>
    </div>
  );
}

/** A full-screen panel over the game — how-to, results, anything modal. */
export function Overlay({
  title,
  subtitle,
  dismiss = "Press again to close",
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  dismiss?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-screen-overlay
      className="absolute inset-0 z-20 flex flex-col gap-4 overflow-y-auto bg-black/96 px-[var(--screen-rim,24px)] pb-[calc(var(--screen-rim,24px)+var(--screen-notch,0px))] pt-[calc(var(--screen-rim,24px)+2.25rem)] text-left"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[20px] font-bold uppercase tracking-[0.16em] text-brand-500">
            {title}
          </div>
          {subtitle && (
            <div className="mt-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-text-3">
              {subtitle}
            </div>
          )}
        </div>
        <span className="mt-1 shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
          {dismiss}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The centred "nothing to play right now" state. */
export function Notice({
  title,
  body,
  hint = "Retrying",
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
      <p className="font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-text">
        {title}
      </p>
      {body && (
        <p className="max-w-[38ch] font-mono text-[11.5px] font-medium leading-[1.6] text-text-2">
          {body}
        </p>
      )}
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-3">
        {hint}
      </p>
    </div>
  );
}

/**
 * The canned notices, in the same three slots the reference uses — rewritten
 * for this venue, which is a public order book rather than their service.
 */
export const NOTICES = {
  noMarket: {
    title: "No window open",
    body: "Rounds here are live DreamDEX windows, and the venue is not rolling one right now. Nothing was charged and your balance is untouched.",
    hint: "Checking for the next one",
  },
  marketsError: {
    title: "Can't reach the venue",
    body: "We can't read the order book from Somnia. That is a connection problem on our side, not your account — your balance and any open position are on chain and safe.",
    hint: "Retrying",
  },
  noLiquidity: {
    title: "Nobody on the other side",
    body: "Your order found no seller at that price. On a book this thin that is a normal outcome, not an error. Try the market price, or the next window.",
    hint: "Nothing was spent",
  },
} as const;

// ── The game-screen composition ─────────────────────────────────────────────
// Taken from the reference's own game chunks rather than its design-system
// mock: a bordered header bar, an optional tile row, a full-bleed stage, and a
// footer that *occupies the notch* with its content held to the left of the
// Play key. That last detail is what stops the bottom of the aperture reading
// as dead space.

/**
 * The bordered header: eyebrow, the spot reading, and a right-hand readout.
 *
 * The spot used to be the single largest element on the screen. It is a
 * *reference* price — it tells you where the market is, not what a press is
 * worth — so it stays here as the anchor and the action area carries the
 * headline instead. See `Payoff`.
 */
export function Header({
  eyebrow,
  value,
  rightLabel,
  rightValue,
  rightNote,
  badge,
}: {
  eyebrow: React.ReactNode;
  value: React.ReactNode;
  rightLabel?: React.ReactNode;
  rightValue?: React.ReactNode;
  /**
   * A quiet second line under the right-hand readout.
   *
   * The right slot is the balance — what you have to play with. The countdown
   * rides here beneath it: we need a clock (the reference has no window to run
   * out) but it does not need to own the slot on its own.
   */
  rightNote?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-[var(--color-line-strong)] bg-black">
      <div className="flex items-start justify-between gap-3 px-[var(--screen-rim,24px)] pb-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {eyebrow}
          </div>
          <div className="tnum truncate text-[26px] font-bold leading-tight text-text-2">
            {value}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {rightLabel != null && (
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
              {rightLabel}
            </div>
          )}
          {rightValue != null && (
            <div className="tnum text-xl font-bold leading-none text-text">
              {rightValue}
            </div>
          )}
          {rightNote != null && (
            <div className="tnum mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              {rightNote}
            </div>
          )}
          {badge != null && (
            <div className="mt-1 inline-flex items-center border border-brand-500/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-brand-500">
              {badge}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The optional strip of small tiles under the header. */
export function TileRow({
  cols = 4,
  children,
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-[var(--color-line-strong)] bg-black px-[var(--screen-rim,24px)] py-2">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

/** One tile in the strip. */
export function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: React.ReactNode;
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
    <div className="min-w-0 border border-white/10 px-1.5 py-1">
      <div className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </div>
      <div className={`tnum truncate text-[15px] font-extrabold leading-tight ${cls}`}>
        {value}
      </div>
    </div>
  );
}

/** The stage: the chart runs full-bleed here and readouts float over it. */
export function Stage({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-0 flex-1">{children}</div>;
}

/** A readout floated over the stage, top right. */
export function StageReadout({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute right-[var(--screen-rim,24px)] top-3 z-10 text-right">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </div>
      <div className="mt-0.5 flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/** The result splash, thrown across the middle of the stage. */
export function Splash({
  value,
  won,
}: {
  value: React.ReactNode;
  won: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
      <span
        className={`tnum font-black leading-none text-[clamp(40px,12vh,84px)] ${
          won ? "text-up" : "text-down"
        }`}
        style={{ animation: "wave-splash 1.6s var(--ease-out-quart) both" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The footer bar. It deliberately claims the notch band — `min-h` is the notch
 * itself — and holds its content to the left 60% so the Play key never covers
 * it. This is how the reference uses the bottom of an L-shaped aperture.
 */
export function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-[var(--color-line-strong)] bg-black px-[var(--screen-rim,24px)] pb-[var(--screen-rim,24px)] pt-3.5 min-h-[var(--screen-notch,21%)]">
      <div className="max-w-[62%]">{children}</div>
    </div>
  );
}

/**
 * The headline of the action area, and the largest thing on the screen.
 *
 * What a press is worth — the multiple, or what the book will pay for a
 * position already held. It used to float over the chart as a `StageReadout`,
 * where it fought the entry tag and the change reading for the same corner. The
 * reference puts it under the chart, beneath a line naming what it costs and
 * what it returns, and lets it be big there.
 */
export function Payoff({
  label,
  value,
  tone = "brand",
}: {
  /** The line above — what this play costs and what it returns. */
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "up" | "down" | "brand";
}) {
  const colour =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-brand-500";
  const shadow =
    tone === "up"
      ? "var(--color-up)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-brand-500)";
  return (
    <div>
      <div className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
        {label}
      </div>
      <div
        className={`tnum truncate text-[42px] font-black leading-none ${colour}`}
        style={{ textShadow: `0 0 16px ${shadow}` }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The countdown, thrown across the whole stage at 15% opacity behind the
 * chart. This is the reference's answer to "what does a live position look
 * like" — it does **not** swap to a data screen. The market keeps drawing and
 * the clock becomes the wallpaper.
 */
export function GhostCount({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
      <span className="tnum font-black leading-none text-text opacity-15 text-[clamp(64px,18vh,128px)]">
        {children}
      </span>
    </div>
  );
}

/** The centred idle pair — side on the left, multiple on the right. */
export function StageCentre({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-[var(--screen-rim,24px)]">
      {/*
        The pair sits on its own plate.
        
        It used to be bare text centred over the stage, so the price line ran
        straight through the glyphs — on Snipe the payout and the cost were
        drawn across the trace and neither was clean to read. A readout that
        floats over live data needs a ground under it, and darkening a band of
        the chart is cheaper than moving the readout somewhere the chart is not.
        The blur keeps the line faintly visible behind, so it still reads as one
        surface rather than a box dropped on top.
      */}
      <div className="flex items-center gap-8 rounded-lg bg-black/72 px-5 py-2.5 backdrop-blur-[3px]">
        {children}
      </div>
    </div>
  );
}

/** One half of that pair. */
export function CentreStat({
  label,
  value,
  tone = "brand",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "up" | "down" | "brand";
}) {
  const colour =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-brand-500";
  const shadow =
    tone === "up"
      ? "var(--color-up)"
      : tone === "down"
        ? "var(--color-down)"
        : "var(--color-brand-500)";
  return (
    <div className="text-center">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
        {label}
      </div>
      <div
        className={`tnum text-[26px] font-extrabold leading-none ${colour}`}
        style={{ textShadow: `0 0 14px ${shadow}` }}
      >
        {value}
      </div>
    </div>
  );
}

/** The hairline between the two centre stats. */
export function CentreRule() {
  return <div className="h-9 w-px bg-[var(--color-line-strong)]" />;
}
