/**
 * Haptics.
 *
 * `navigator.vibrate` has no amplitude control, so intensity is emulated with
 * PWM: a 20ms window is sliced into on/off chunks proportional to the requested
 * intensity, then flattened into the [on, off, on, ...] array vibrate expects.
 *
 * Three channels — press, outcome and detent — share one scheduler so a knob
 * click can never stomp on a win stinger.
 */

const PWM_WINDOW = 20;
const MAX_DURATION = 1000;

export type PressPreset =
  | "tick"
  | "tickSmall"
  | "low"
  | "selection"
  | "mid"
  | "medium"
  | "high"
  | "rigid"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export type OutcomePreset = "win" | "lose" | "cashOut" | "achievement";

/** `[duration, ...]` where a negative number is a pause. */
type Pattern = number[];

const PRESS_PATTERNS: Record<PressPreset, Pattern> = {
  tick: [10],
  tickSmall: [7],
  low: [10],
  selection: [10],
  mid: [15],
  medium: [15],
  high: [20],
  rigid: [20],
  heavy: [20],
  success: [30, -60, 40],
  warning: [40, -100, 40],
  error: [40, -40, 40, -40, 40],
};

const OUTCOME_PATTERNS: Record<OutcomePreset, Pattern> = {
  win: [20, -50, 30, -50, 70],
  lose: [70, -40, 25],
  cashOut: [25, -45, 25],
  achievement: [20, -40, 20, -40, 20, -60, 90],
};

/** Slice one buzz into PWM chunks so it *feels* like the requested intensity. */
function pwm(duration: number, intensity: number): number[] {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped >= 0.999) return [duration];
  if (clamped <= 0.001) return [0, duration];

  const out: number[] = [];
  let remaining = duration;
  while (remaining > 0) {
    const window = Math.min(PWM_WINDOW, remaining);
    const on = Math.round(window * clamped);
    const off = window - on;
    out.push(on, off);
    remaining -= window;
  }
  return out;
}

/** Flatten a pattern into the alternating on/off array `vibrate` wants. */
function flatten(pattern: Pattern, intensity: number): number[] {
  const out: number[] = [];
  for (const step of pattern) {
    if (!Number.isFinite(step)) continue;
    if (step < 0) {
      // A pause. Merge into the trailing "off" slot when there is one.
      const pause = Math.min(MAX_DURATION, -step);
      if (out.length % 2 === 0) out.push(0, pause);
      else out.push(pause);
      continue;
    }
    const duration = Math.min(MAX_DURATION, step);
    const chunks = pwm(duration, intensity);
    if (out.length % 2 === 1) out.push(0);
    out.push(...chunks);
  }
  return out;
}

let enabled = true;
let channel: "idle" | "press" | "detent" | "outcome" = "idle";
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let queuedPress: { preset: PressPreset; intensity: number } | null = null;
const lastOutcome = new Map<OutcomePreset, number>();

/** Detent clicks queue up to 3 deep, fired 25ms apart. */
let detentQueue = 0;
let detentTimer: ReturnType<typeof setInterval> | null = null;

function supported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    enabled
  );
}

function fire(pattern: number[]): number {
  if (!supported()) return 0;
  try {
    navigator.vibrate(pattern);
  } catch {
    return 0;
  }
  return pattern.reduce((a, b) => a + b, 0);
}

function hold(kind: typeof channel, ms: number) {
  channel = kind;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    channel = "idle";
    releaseTimer = null;
    if (queuedPress) {
      const next = queuedPress;
      queuedPress = null;
      press(next.preset, next.intensity);
    }
  }, ms);
}

export function setHapticsEnabled(next: boolean) {
  enabled = next;
  if (!next && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

/** Press feedback. Queued if an outcome pattern is mid-flight. */
export function press(preset: PressPreset = "tick", intensity = 1) {
  if (!supported()) return;
  if (channel === "outcome") {
    queuedPress = { preset, intensity };
    return;
  }
  const ms = fire(flatten(PRESS_PATTERNS[preset] ?? PRESS_PATTERNS.tick, intensity));
  hold("press", ms);
}

/** Outcome feedback, deduped for 1s on the same name. */
export function outcome(name: OutcomePreset, intensity = 1) {
  if (!supported()) return;
  const now = Date.now();
  const previous = lastOutcome.get(name) ?? 0;
  if (now - previous < 1000) return;
  lastOutcome.set(name, now);
  const ms = fire(flatten(OUTCOME_PATTERNS[name], intensity));
  hold("outcome", ms);
}

/** A knob or thumbwheel detent. Coalesces so fast spins stay legible. */
export function detent() {
  if (!supported() || channel === "outcome") return;
  detentQueue = Math.min(3, detentQueue + 1);
  if (detentTimer) return;
  const drain = () => {
    if (detentQueue <= 0) {
      if (detentTimer) clearInterval(detentTimer);
      detentTimer = null;
      return;
    }
    detentQueue -= 1;
    fire([7]);
    hold("detent", 12);
  };
  drain();
  detentTimer = setInterval(drain, 25);
}

const haptics = { press, outcome, detent, setHapticsEnabled, isHapticsEnabled };
export default haptics;
