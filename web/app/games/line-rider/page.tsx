"use client";

/**
 * Line Rider — a free arcade minigame. You ride the price line; hold the main
 * key to dive, release to climb, and stay on the trace as long as you can.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import { ScreenRoot } from "@/components/screen/Screen";
import MinigameBoard from "@/components/games/MinigameBoard";
import { useMinigameBest, useStoreActions } from "@/lib/api/hooks";
import { playLose, playTick } from "@/lib/sound";
import haptics from "@/lib/haptics";

const W = 240;
const H = 300;
const SPEED = 120;
const TOLERANCE = 30;

export default function LineRiderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const actions = useStoreActions();
  const best = useMinigameBest("line-rider");

  const raf = useRef(0);
  const diving = useRef(false);
  const state = useRef({
    rider: H / 2,
    vy: 0,
    // The terrain is generated ahead of the rider as a rolling random walk.
    trace: [] as number[],
    offset: 0,
    score: 0,
  });

  const end = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setRunning(false);
    setLastScore(state.current.score);
    actions.submitMinigameScore("line-rider", state.current.score);
    playLose();
    haptics.outcome("lose");
  }, [actions]);

  const start = useCallback(() => {
    const trace: number[] = [];
    let y = H / 2;
    let slope = 0;
    for (let i = 0; i < W + 120; i++) {
      slope += (Math.random() - 0.5) * 0.5;
      slope = Math.max(-1.6, Math.min(1.6, slope));
      y = Math.max(50, Math.min(H - 50, y + slope));
      trace.push(y);
    }
    state.current = { rider: trace[46], vy: 0, trace, offset: 0, score: 0 };
    setScore(0);
    setLastScore(null);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let last = performance.now();
    let sinceTick = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;

      // Extend the trace as we advance.
      s.offset += SPEED * dt;
      while (s.offset > 1) {
        s.offset -= 1;
        const tail = s.trace[s.trace.length - 1];
        const prev = s.trace[s.trace.length - 2] ?? tail;
        let slope = tail - prev + (Math.random() - 0.5) * 0.6;
        slope = Math.max(-1.6, Math.min(1.6, slope));
        s.trace.push(Math.max(50, Math.min(H - 50, tail + slope)));
        s.trace.shift();
      }

      // Rider physics: dive while held, drift up otherwise.
      s.vy += (diving.current ? 620 : -420) * dt;
      s.vy = Math.max(-260, Math.min(260, s.vy));
      s.rider += s.vy * dt;

      const target = s.trace[46];
      if (Math.abs(s.rider - target) > TOLERANCE) return end();
      if (s.rider < 6 || s.rider > H - 6) return end();

      sinceTick += dt;
      if (sinceTick > 0.35) {
        sinceTick = 0;
        s.score += 1;
        setScore(s.score);
        if (s.score % 10 === 0) playTick();
      }

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);

      // Tolerance corridor
      ctx.strokeStyle = "rgba(45,226,214,.16)";
      ctx.lineWidth = TOLERANCE * 2;
      ctx.beginPath();
      s.trace.forEach((y, i) => (i ? ctx.lineTo(i, y) : ctx.moveTo(i, y)));
      ctx.stroke();

      // The line itself
      ctx.strokeStyle = "#2de2d6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.trace.forEach((y, i) => (i ? ctx.lineTo(i, y) : ctx.moveTo(i, y)));
      ctx.stroke();

      const off = Math.abs(s.rider - target) / TOLERANCE;
      ctx.fillStyle = off > 0.7 ? "#ff5a4d" : "#ffc016";
      ctx.beginPath();
      ctx.arc(46, s.rider, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(242,242,242,.9)";
      ctx.font = "bold 22px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 34);

      raf.current = requestAnimationFrame(frame);
    };

    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [running, end]);

  // The console reports key-down; hold is emulated by diving for a moment.
  const dive = useCallback(() => {
    if (!running) {
      start();
      return;
    }
    diving.current = true;
    haptics.press("tickSmall");
    window.setTimeout(() => {
      diving.current = false;
    }, 260);
  }, [running, start]);

  useProgramConsole({
    main: { label: running ? "DIVE" : "PLAY", pulse: true, onPress: dive },
    status: {
      left: running ? `SCORE ${score}` : "LINE RIDER",
      right: `BEST ${best}`,
    },
  });

  if (!running) {
    return (
      <MinigameBoard
        title="Line Rider"
        best={best}
        lastScore={lastScore}
      />
    );
  }

  return (
    <ScreenRoot className="items-center justify-center">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="h-auto w-full rounded-md"
      />
    </ScreenRoot>
  );
}
