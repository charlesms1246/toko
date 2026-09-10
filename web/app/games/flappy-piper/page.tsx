"use client";

/**
 * Flappy Piper — ported 1:1 from the reference build's engine.
 *
 * Every constant below is theirs, and the model is theirs too: the canvas is
 * responsive and DPR-scaled rather than a fixed bitmap, the bird's height is a
 * **fraction of the screen** so the game plays the same at any size, and the
 * obstacles are trading candles rather than pipes — which is the joke the whole
 * console is built on.
 *
 * The one thing not ported is their leaderboard: it is server-backed, and we
 * have no server to hold one. The personal best is real and local, which is
 * what we have always shown.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "@/lib/react/hooks";
import { Bird } from "lucide-react";
import { useProgramConsole } from "@/lib/console/controls";
import { useMinigameBest, useStoreActions } from "@/lib/api/hooks";
import { playLose, playTick } from "@/lib/sound";
import haptics from "@/lib/haptics";

// ── The reference's constants, verbatim ─────────────────────────────────────
const BIRD_X = 0.28; // b — how far across the screen the bird sits
const BIRD_SIZE = 64; // x
const BIRD_H = (395 / 567) * BIRD_SIZE; // S
const HIT_PAD = 16; // C — horizontal collision padding
const EDGE = 23; // w — px kept clear of the ceiling and floor
const GRAVITY = 5.6; // T — in screen-heights per second squared
const FLAP = -1.42; // E
const TERMINAL = 2.65; // D
const RAMP_S = 48; // j — seconds to full difficulty
const SPEED_MIN = 138; // k
const SPEED_MAX = 172; // A
const SPACING_MAX = 190; // M
const SPACING_MIN = 165; // N
const CANDLE_W = 30; // P
const WICK = 15; // F
const GAP_MAX = 0.205; // I — half-gap, as a fraction of height
const GAP_MIN = 0.145; // L
const MARGIN = 0.06; // R — keeps a gap off the very edge
const DRIFT = 0.28; // z — how far a gap may wander from the last
const UP = [52, 211, 153] as const; // q
const DOWN = [255, 90, 77] as const; // K

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rgba = (c: readonly number[], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

interface Candle {
  x: number;
  center: number;
  half: number;
  scored: boolean;
}

export default function FlappyPiperPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"intro" | "playing" | "over">("intro");
  const [score, setScore] = useState(0);
  const [run, setRun] = useState({ score: 0, seconds: 0, flaps: 0 });
  const lastScore = run.score;
  const actions = useStoreActions();
  const best = useMinigameBest("flappy-piper");

  const engine = useRef({
    w: 0,
    h: 0,
    birdY: 0.42,
    /** Flaps this run. Real, and the only other thing the run measures. */
    flaps: 0,
    angle: -0.35,
    vy: 0,
    elapsed: 0,
    parallax: 0,
    spawnX: 0,
    lastCenter: 0.42,
    candles: [] as Candle[],
    running: false,
    raf: 0,
    last: 0,
    score: 0,
  });

  const end = useCallback(() => {
    const e = engine.current;
    e.running = false;
    cancelAnimationFrame(e.raf);
    // Captured before the reset. Candles passed, seconds airborne, flaps spent
    // — all three are things the run did. There is no rank and no global board,
    // because there is no server to hold one.
    setRun({ score: e.score, seconds: e.elapsed, flaps: e.flaps });
    setPhase("over");
    actions.submitMinigameScore("flappy-piper", e.score);
    playLose();
    haptics.press("high");
  }, [actions]);
  const endRef = useLatest(end);

  // ── The loop ──────────────────────────────────────────────────────────────
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
      if (!e.running) draw();
    };

    const difficulty = () => clamp01(e.elapsed / RAMP_S);
    const spacing = () => lerp(SPACING_MAX, SPACING_MIN, difficulty());

    const nextCenter = (half: number) => {
      const lo = half + MARGIN;
      const hi = 1 - half - MARGIN;
      let c = e.lastCenter + (Math.random() * 2 - 1) * DRIFT;
      c = Math.max(lo, Math.min(hi, c));
      e.lastCenter = c;
      return c;
    };

    const fill = () => {
      const half = lerp(GAP_MAX, GAP_MIN, difficulty());
      while (e.spawnX < e.w + spacing()) {
        e.candles.push({
          x: e.spawnX,
          center: nextCenter(half),
          half,
          scored: false,
        });
        e.spawnX += spacing();
      }
    };

    const draw = () => {
      const { w, h } = e;
      ctx.clearRect(0, 0, w, h);

      // A faint grid that scrolls, so speed reads even between candles.
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      for (let x = -((e.parallax | 0) % 64); x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      for (const c of e.candles) {
        const top = (c.center - c.half) * h;
        const bottom = (c.center + c.half) * h;
        const x = c.x - CANDLE_W / 2;
        // Two candles, one hanging from the ceiling and one standing on the
        // floor — red above, green below, each with its wick.
        ctx.fillStyle = rgba(DOWN, 0.9);
        ctx.fillRect(x, 0, CANDLE_W, top);
        ctx.strokeStyle = rgba(DOWN, 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.x, top);
        ctx.lineTo(c.x, top + WICK);
        ctx.stroke();

        ctx.fillStyle = rgba(UP, 0.9);
        ctx.fillRect(x, bottom, CANDLE_W, h - bottom);
        ctx.strokeStyle = rgba(UP, 0.9);
        ctx.beginPath();
        ctx.moveTo(c.x, bottom);
        ctx.lineTo(c.x, bottom - WICK);
        ctx.stroke();
      }

      // The bird: a rounded chip, banked by its vertical speed.
      const bx = e.w * BIRD_X;
      const by = e.birdY * h;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(e.angle);
      ctx.fillStyle = "#ffc016";
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_SIZE / 4, BIRD_H / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#241008";
      ctx.beginPath();
      ctx.ellipse(BIRD_SIZE / 12, -BIRD_H / 16, 2.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const step = (dt: number) => {
      // The screen surface is positioned by the console every frame, so on the
      // first ticks the canvas can still measure 0. Without this the bird's
      // radius is `EDGE / 0` and the very first step reports a floor strike.
      if (e.h <= 0 || e.w <= 0) return true;
      e.elapsed += dt;
      const speed = lerp(SPEED_MIN, SPEED_MAX, difficulty());

      e.vy = Math.min(TERMINAL, e.vy + GRAVITY * dt);
      e.birdY += e.vy * dt;
      e.angle += ((e.vy * 0.5 - e.angle) * Math.min(1, dt * 6));
      e.parallax = (e.parallax + speed * 0.4 * dt) % 64;

      e.spawnX -= speed * dt;
      for (const c of e.candles) c.x -= speed * dt;
      while (e.candles.length && e.candles[0].x < -CANDLE_W) e.candles.shift();
      fill();

      const bx = e.w * BIRD_X;
      for (const c of e.candles) {
        if (!c.scored && c.x + CANDLE_W / 2 < bx) {
          c.scored = true;
          e.score += 1;
          setScore(e.score);
          playTick();
        }
      }

      const r = EDGE / e.h;
      if (e.birdY < r) {
        e.birdY = r;
        e.vy = 0;
      }
      if (e.birdY > 1 - r) return false;

      const reach = CANDLE_W / 2 + HIT_PAD;
      for (const c of e.candles) {
        if (Math.abs(c.x - bx) > reach) continue;
        if (e.birdY - r < c.center - c.half) return false;
        if (e.birdY + r > c.center + c.half) return false;
      }
      return true;
    };

    const frame = (now: number) => {
      // The console positions and scales the screen surface every frame, so the
      // canvas can still be 0x0 when the effect first runs — and a
      // ResizeObserver bound to a canvas that never changes size again will
      // not rescue it. Re-measure until we have a box.
      if (e.w <= 0 || e.h <= 0) measure();
      const dt = Math.min(0.05, (now - e.last) / 1000);
      e.last = now;
      if (e.running) {
        if (!step(dt)) {
          e.running = false;
          endRef.current();
        }
      }
      draw();
      e.raf = requestAnimationFrame(frame);
    };

    // `fill` is the one thing a fresh run needs from in here.
    (engine.current as unknown as { fill: () => void }).fill = fill;

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
    // `endRef` is a stable ref; naming it keeps the rule happy without
    // rebuilding the canvas, which must be set up exactly once.
  }, [endRef]);


  const start = useCallback(() => {
    const e = engine.current;
    e.birdY = 0.42;
    e.angle = -0.35;
    e.vy = FLAP;
    e.flaps = 0;
    e.score = 0;
    e.elapsed = 0;
    e.candles = [];
    e.lastCenter = 0.42;
    e.spawnX = e.w + e.w * 0.12;
    (engine.current as unknown as { fill: () => void }).fill();
    e.last = performance.now();
    e.running = true;
    setScore(0);
    setPhase("playing");
    haptics.press("high");
  }, []);

  const flap = useCallback(() => {
    const e = engine.current;
    if (!e.running) {
      start();
      return;
    }
    e.flaps += 1;
    e.vy = FLAP;
    haptics.press("low");
  }, [start]);

  useProgramConsole({
    main: {
      label: phase === "playing" ? "FLAP" : phase === "over" ? "PLAY AGAIN" : "PLAY",
      pulse: true,
      onPress: flap,
    },
    status: { left: "FLAPPY PIPER", right: `BEST ${best}` },
  });

  const isBest = lastScore > 0 && lastScore >= best;
  const kicker = isBest ? "Top of the board" : "Run over";
  /** This run as a share of the personal best, for the result screen's bar. */
  const pctOfBest =
    best > 0 ? Math.round(Math.min(1, lastScore / best) * 100) : 100;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-text">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* HUD */}
      <div className="pointer-events-none relative z-10 px-[var(--screen-rim,24px)] pt-[18px]">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          Score
        </div>
        <div className="tnum text-4xl font-extrabold leading-none text-text">
          {score}
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
          Best <span className="tnum text-text-2">{best}</span>
        </div>
      </div>

      {phase === "intro" && (
        <div className="absolute inset-0 z-20 flex flex-col justify-center bg-black/93 p-[var(--screen-rim,24px)] backdrop-blur-[1px]">
          <div className="flex items-center gap-2.5">
            <Bird size={26} strokeWidth={2.4} className="text-brand-500" />
            <div className="text-4xl font-extrabold leading-none tracking-tight text-text">
              Flappy Piper
            </div>
          </div>
          <p className="mt-2 max-w-[82%] text-sm leading-snug text-text-2">
            Tap to lift the chip, let it fall, and slip through the candle gaps.
            It moves calmly, but one bad line ends the run.
          </p>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-text-3">
            Press the <span className="text-brand-500">big button</span>
          </div>
        </div>
      )}

      {phase === "over" && (
        /*
         * Laid out down the whole screen, the same three bands Line Rider's
         * result uses: the verdict, what the run did, and what to press. The
         * scrim is not opaque — the candles you flew into stay visible behind
         * the numbers, and that last frame is the run's own.
         */
        <div
          className="absolute inset-0 z-20 flex flex-col justify-between p-[var(--screen-rim,24px)]"
          style={{
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
                    : "var(--color-up)",
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                  Time airborne
                </div>
                <div className="tnum mt-0.5 text-2xl font-extrabold leading-none text-text">
                  {run.seconds.toFixed(1)}
                  <span className="ml-0.5 text-sm font-bold text-text-3">s</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                  Flaps
                </div>
                <div className="tnum mt-0.5 text-2xl font-extrabold leading-none text-text">
                  {run.flaps}
                </div>
              </div>
            </div>
          </div>

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
