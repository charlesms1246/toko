"use client";

/**
 * Line Rider — ported 1:1 from the reference build's engine.
 *
 * The knob steers. Hold the marker on the line and the multiplier climbs and
 * the score runs; drift off and grip bleeds away. Grip is the whole health
 * model — there is no collision, just how long you can stay on.
 *
 * Every constant and the terrain generator are theirs. The line's colour is a
 * ramp driven by the multiplier: cyan through brand yellow to red as it climbs
 * from 1 to 8, which is the only readout the game really needs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { useProgramConsole } from "@/lib/console/controls";
import { useLatest } from "@/lib/react/hooks";
import { useMinigameBest, useStoreActions } from "@/lib/api/hooks";
import { playLose, playTick } from "@/lib/sound";
import haptics from "@/lib/haptics";

// ── The reference's constants, verbatim ─────────────────────────────────────
const RIDE_X = 0.32; // b — where the marker sits across the screen
const Y_MIN = 0.16; // x — the terrain never climbs past these
const Y_MAX = 0.84; // S
const TARGET_LO = 0.92; // C — knob 0 puts you here (bottom)
const TARGET_HI = 0.08; // w — knob 1 puts you here (top)
const SEG = 12; // T — px per terrain segment
const WARMUP = 2; // E — seconds before grip can bleed
const SPEED_MIN = 95; // D
const SPEED_MAX = 360; // O
const OVER_SPEED = 6; // k — extra speed once past full difficulty
const RAMP = 34; // A — seconds from warm-up to full difficulty
const TOL_MAX = 0.08; // j — how close counts as "on the line"
const TOL_MIN = 0.04; // M
const FOLLOW = 16; // N — how fast the marker chases the knob
const SCORE_RATE = 34; // P
const MULT_BASE = 0.55; // ne
const MULT_BONUS = 1.5; // F
const MULT_DECAY = 9; // I
const GRIP_GAIN = 0.26; // L
const GRIP_LOSS_MIN = 0.4; // R
const GRIP_LOSS_MAX = 1.5; // z
const GRIP_OVER = 0.02; // B
const OFF_GRACE = 0.12; // V
const CYAN = [45, 226, 214] as const; // H
const BRAND = [255, 192, 22] as const; // U
const RED = [255, 90, 77] as const; // W

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The line's colour, ramped by the multiplier from 1 through 8. */
function lineColour(mult: number) {
  const t = clamp01((mult - 1) / 7);
  const [a, b] = t < 0.5 ? [CYAN, BRAND] : [BRAND, RED];
  const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(
    lerp(a[1], b[1], k),
  )},${Math.round(lerp(a[2], b[2], k))})`;
}

export default function LineRiderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"intro" | "playing" | "over">("intro");
  const [hud, setHud] = useState({ score: 0, mult: 1, grip: 1 });
  const [run, setRun] = useState({ score: 0, seconds: 0, peakMult: 1 });
  const lastScore = run.score;
  const [knob, setKnob] = useState(50);
  const actions = useStoreActions();
  const best = useMinigameBest("line-rider");

  const engine = useRef({
    w: 0,
    h: 0,
    running: false,
    raf: 0,
    last: 0,
    pts: [] as number[],
    head: 0,
    worldX: 0,
    genCur: 0.5,
    genGoal: 0.5,
    segsToGoal: 0,
    target: 0.5,
    pipY: 0.5,
    score: 0,
    mult: 1,
    /** Highest multiplier the run actually reached. Read on the result screen. */
    peakMult: 1,
    grip: 1,
    elapsed: 0,
    offFor: 0,
    onFor: 0,
    onLine: false,
    trail: [] as { x: number; y: number; life: number }[],
  });

  const end = useCallback(() => {
    const e = engine.current;
    // The run's own numbers, captured before the engine is reset. Every one of
    // them is something the run actually did — there is no rank here and no
    // global board, because there is no server to hold one.
    setRun({
      score: Math.round(e.score),
      seconds: e.elapsed,
      peakMult: e.peakMult,
    });
    setPhase("over");
    actions.submitMinigameScore("line-rider", Math.round(e.score));
    playLose();
    haptics.press("high");
  }, [actions]);
  const endRef = useLatest(end);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const e = engine.current;

    const measure = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      e.w = r.width;
      e.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const difficulty = () => clamp01((e.elapsed - WARMUP) / RAMP);
    const over = () => Math.max(0, e.elapsed - WARMUP - RAMP);

    /** The terrain generator: wander toward a goal, occasionally jump. */
    const nextY = () => {
      const d = difficulty();
      if (e.segsToGoal <= 0) {
        const jump = d > 0.35 && Math.random() < 0.05 + d * 0.12;
        const span = lerp(0.16, 0.52, d) * (jump ? 1.7 : 1);
        const lo = Math.max(Y_MIN, e.genCur - span);
        const hi = Math.min(Y_MAX, e.genCur + span);
        e.genGoal = lo + Math.random() * (hi - lo);
        const base = lerp(16, 3.2, d);
        e.segsToGoal = Math.max(
          2,
          Math.round((jump ? base * 0.35 : base) * (0.6 + Math.random() * 0.8)),
        );
      }
      e.segsToGoal -= 1;
      e.genCur += (e.genGoal - e.genCur) * lerp(0.09, 0.3, d);
      return Math.max(Y_MIN, Math.min(Y_MAX, e.genCur));
    };

    const fillToWidth = () => {
      const need = Math.ceil(e.w / SEG) + 4;
      while (e.pts.length < need) e.pts.push(nextY());
    };

    const lineYAt = (px: number) => {
      const t = (e.worldX + px) / SEG;
      const i = Math.floor(t - e.head);
      if (i < 0 || i + 1 >= e.pts.length) {
        return e.pts[Math.max(0, Math.min(e.pts.length - 1, i))] ?? 0.5;
      }
      return lerp(e.pts[i], e.pts[i + 1], t - e.head - i);
    };

    const draw = () => {
      const { w, h } = e;
      if (w <= 0 || h <= 0) return;
      ctx.clearRect(0, 0, w, h);

      const colour = lineColour(e.mult);

      // The line itself, drawn a segment at a time from the generated points.
      ctx.beginPath();
      for (let i = 0; i < e.pts.length; i++) {
        const x = (e.head + i) * SEG - e.worldX;
        const y = e.pts[i] * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.shadowColor = colour;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // The trail behind the marker.
      for (const t of e.trail) {
        ctx.globalAlpha = Math.max(0, t.life) * 0.5;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // The marker: bright when it is on the line, hollow when it is not.
      const x = w * RIDE_X;
      const y = e.pipY * h;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      if (e.onLine) {
        ctx.fillStyle = colour;
        ctx.shadowColor = colour;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const step = (dt: number) => {
      if (e.w <= 0 || e.h <= 0) return true;
      const d = difficulty();
      e.elapsed += dt;
      const speed = lerp(SPEED_MIN, SPEED_MAX, d) + over() * OVER_SPEED;

      e.worldX += speed * dt;
      while ((e.head + 1) * SEG < e.worldX) {
        e.pts.shift();
        e.head += 1;
      }
      fillToWidth();

      const want = lerp(TARGET_LO, TARGET_HI, e.target);
      e.pipY += (want - e.pipY) * Math.min(1, dt * FOLLOW);

      const x = e.w * RIDE_X;
      const lineY = lineYAt(x);
      const tol = lerp(TOL_MAX, TOL_MIN, d);
      const dist = Math.abs(e.pipY - lineY);
      const on = dist <= tol;

      if (on) {
        e.onFor += dt;
        e.offFor = 0;
        const q = 1 - clamp01(dist / tol);
        e.mult += dt * (MULT_BASE + MULT_BONUS * q);
        if (e.mult > e.peakMult) e.peakMult = e.mult;
        e.score += dt * SCORE_RATE * e.mult * (0.5 + 0.5 * q);
        e.grip = Math.min(1, e.grip + dt * GRIP_GAIN);
      } else {
        e.offFor += dt;
        e.onFor = 0;
        e.mult = Math.max(1, e.mult - dt * MULT_DECAY);
        if (e.offFor > OFF_GRACE && e.elapsed > WARMUP) {
          e.grip -=
            dt * (lerp(GRIP_LOSS_MIN, GRIP_LOSS_MAX, d) + over() * GRIP_OVER);
        }
      }
      if (on !== e.onLine && on) playTick();
      e.onLine = on;

      e.trail.push({ x, y: e.pipY * e.h, life: 1 });
      let keep = 0;
      for (const t of e.trail) {
        t.x -= speed * dt;
        t.life -= dt * 0.7;
        if (t.life > 0 && t.x > -20) e.trail[keep++] = t;
      }
      e.trail.length = keep;

      if (e.grip <= 0) {
        e.grip = 0;
        return false;
      }
      return true;
    };

    const frame = (now: number) => {
      if (e.w <= 0 || e.h <= 0) measure();
      const dt = Math.min(0.05, (now - e.last) / 1000);
      e.last = now;
      if (e.running) {
        if (!step(dt)) {
          e.running = false;
          endRef.current();
        }
        setHud({ score: e.score, mult: e.mult, grip: e.grip });
      }
      draw();
      e.raf = requestAnimationFrame(frame);
    };

    (engine.current as unknown as { fill: () => void }).fill = fillToWidth;

    measure();
    e.last = performance.now();
    e.raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(e.raf);
      e.running = false;
    };
  }, [endRef]);

  const start = useCallback(() => {
    const e = engine.current;
    e.pts = [];
    e.head = 0;
    e.worldX = 0;
    e.genCur = 0.5;
    e.genGoal = 0.5;
    e.segsToGoal = 0;
    e.pipY = 0.5;
    e.score = 0;
    e.mult = 1;
    e.peakMult = 1;
    e.grip = 1;
    e.elapsed = 0;
    e.offFor = 0;
    e.onFor = 0;
    e.onLine = false;
    e.trail = [];
    (engine.current as unknown as { fill: () => void }).fill();
    e.last = performance.now();
    e.running = true;
    setHud({ score: 0, mult: 1, grip: 1 });
    setPhase("playing");
    haptics.press("high");
  }, []);

  useProgramConsole({
    main: {
      label: phase === "playing" ? "RIDE" : phase === "over" ? "PLAY AGAIN" : "PLAY",
      pulse: true,
      onPress: () => {
        if (!engine.current.running) start();
      },
    },
    knob: {
      min: 0,
      max: 100,
      step: 2,
      value: knob,
      label: "STEER",
      format: () => "",
      onChange: (v) => {
        setKnob(v);
        engine.current.target = v / 100;
      },
    },
  });

  const isBest = lastScore > 0 && lastScore >= best;
  const kicker = isBest ? "Top of the board" : "Run over";
  /** This run as a share of the personal best, for the result screen's bar. */
  const pctOfBest =
    best > 0 ? Math.round(Math.min(1, lastScore / best) * 100) : 100;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-text">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      <div className="pointer-events-none relative z-10 px-[var(--screen-rim,24px)] pt-[18px]">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          Score
        </div>
        <div className="tnum text-4xl font-extrabold leading-none text-text">
          {Math.round(hud.score)}
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          Best <span className="tnum text-text-2">{best}</span>
        </div>

        {phase === "playing" && (
          <div className="mt-3 max-w-[62%]">
            <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
              <span>Grip</span>
              <span className="tnum" style={{ color: lineColour(hud.mult) }}>
                {hud.mult.toFixed(1)}x
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden bg-white/10">
              <div
                className="h-full transition-[width] duration-100 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(1, hud.grip)) * 100}%`,
                  background: lineColour(hud.mult),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {phase === "intro" && (
        <div className="absolute inset-0 z-20 flex flex-col justify-center bg-black/93 p-[var(--screen-rim,24px)] backdrop-blur-[1px]">
          <div className="flex items-center gap-2.5">
            <Activity size={26} strokeWidth={2.4} className="text-brand-500" />
            <div className="text-4xl font-extrabold leading-none tracking-tight text-text">
              Line Rider
            </div>
          </div>
          <p className="mt-2 max-w-[82%] text-sm leading-snug text-text-2">
            Turn the big wheel to follow the line. Stay on it and the multiplier
            climbs; drift off and your grip bleeds away.
          </p>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-text-3">
            Press the <span className="text-brand-500">big button</span>
          </div>
        </div>
      )}

      {phase === "over" && (
        /*
         * The result, laid out down the whole screen rather than clustered in
         * the middle of it.
         *
         * Three bands — the verdict, what the run did, and what to press —
         * spaced by `justify-between`, so a tall aperture reads as composed
         * instead of half empty. The scrim is deliberately not opaque: the
         * terrain you just crashed on stays visible behind the numbers, which
         * is what the reference does with its own chart.
         *
         * Every figure is the run's own. There is no rank and no global board,
         * because there is no server to hold one and a fabricated placing would
         * be worse than none.
         */
        <div
          className="absolute inset-0 z-20 flex flex-col justify-between p-[var(--screen-rim,24px)]"
          style={{
            // Not opaque. The terrain you just came off stays legible under the
            // numbers, which is what gives the screen something to look at
            // besides text — and it is the run's own last frame, not artwork.
            background:
              "linear-gradient(180deg,#000000e0 0%,#0000009e 44%,#000000ee 100%)",
          }}
        >
          <div>
            <div
              className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                isBest ? "text-brand-500" : "text-text-3"
              }`}
            >
              {kicker}
            </div>
            <div
              className="tnum text-[64px] font-extrabold leading-[0.9] text-text"
              style={{
                textShadow: isBest
                  ? "0 0 18px rgba(255,192,22,.55), 0 0 48px rgba(255,192,22,.25)"
                  : "0 0 22px rgba(255,255,255,.16)",
              }}
            >
              {lastScore}
            </div>
            <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-text-3">
              {isBest ? (
                <>Your best yet</>
              ) : (
                <>
                  Best <span className="tnum text-text-2">{best}</span> ·{" "}
                  <span className="tnum text-text-2">{best - lastScore}</span> to
                  beat it
                </>
              )}
            </div>
          </div>

          <div>
            {/* This run measured against the best. A real comparison of two
                real numbers — the only ranking this game can honestly draw. */}
            <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
              <span>This run</span>
              <span className="tnum">{best > 0 ? `${pctOfBest}%` : "—"}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-white/10">
              <div
                className="h-full"
                style={{
                  width: `${pctOfBest}%`,
                  background: isBest
                    ? "var(--color-brand-500)"
                    : lineColour(run.peakMult),
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                  Time on the line
                </div>
                <div className="tnum mt-0.5 text-2xl font-extrabold leading-none text-text">
                  {run.seconds.toFixed(1)}
                  <span className="ml-0.5 text-sm font-bold text-text-3">s</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                  Top multiplier
                </div>
                <div
                  className="tnum mt-0.5 text-2xl font-extrabold leading-none"
                  style={{ color: lineColour(run.peakMult) }}
                >
                  {run.peakMult.toFixed(1)}
                  <span className="ml-0.5 text-sm font-bold opacity-70">x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Kept clear of the Play key's notch on the right, but free to sit
              at the true bottom on the left, where there is no hardware. */}
          <div
            className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-3"
            style={{ paddingRight: "var(--screen-notch, 0px)" }}
          >
            Press the <span className="text-brand-500">big button</span>
          </div>
        </div>
      )}
    </div>
  );
}
