"use client";

/**
 * Flappy Piper — a free arcade minigame. No stake, just a score leaderboard.
 * The main key flaps.
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
const GRAVITY = 1500;
const FLAP = -420;
const PIPE_GAP = 96;
const PIPE_W = 34;
const SPEED = 108;

interface Pipe {
  x: number;
  gapY: number;
  passed: boolean;
}

export default function FlappyPiperPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const actions = useStoreActions();
  const best = useMinigameBest("flappy-piper");

  const state = useRef({ y: H / 2, vy: 0, pipes: [] as Pipe[], score: 0 });
  const raf = useRef(0);
  const flapRef = useRef(false);

  const end = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setRunning(false);
    setLastScore(state.current.score);
    actions.submitMinigameScore("flappy-piper", state.current.score);
    playLose();
    haptics.outcome("lose");
  }, [actions]);

  const start = useCallback(() => {
    state.current = { y: H / 2, vy: FLAP * 0.6, pipes: [], score: 0 };
    setScore(0);
    setLastScore(null);
    setRunning(true);
  }, []);

  const flap = useCallback(() => {
    if (!running) {
      start();
      return;
    }
    flapRef.current = true;
  }, [running, start]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let last = performance.now();
    let spawn = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;

      if (flapRef.current) {
        s.vy = FLAP;
        flapRef.current = false;
        haptics.press("tickSmall");
      }

      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;

      spawn -= dt;
      if (spawn <= 0) {
        spawn = 1.55;
        s.pipes.push({
          x: W,
          gapY: 50 + Math.random() * (H - 100 - PIPE_GAP),
          passed: false,
        });
      }

      for (const pipe of s.pipes) {
        pipe.x -= SPEED * dt;
        if (!pipe.passed && pipe.x + PIPE_W < 46) {
          pipe.passed = true;
          s.score += 1;
          setScore(s.score);
          playTick();
        }
      }
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);

      // Collisions: floor, ceiling, and the pipe mouths.
      if (s.y < 6 || s.y > H - 6) return end();
      for (const pipe of s.pipes) {
        const withinX = 46 + 9 > pipe.x && 46 - 9 < pipe.x + PIPE_W;
        const throughGap = s.y > pipe.gapY && s.y < pipe.gapY + PIPE_GAP;
        if (withinX && !throughGap) return end();
      }

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#2de2d6";
      for (const pipe of s.pipes) {
        ctx.fillRect(pipe.x, 0, PIPE_W, pipe.gapY);
        ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP, PIPE_W, H);
      }

      ctx.fillStyle = "#ffc016";
      ctx.beginPath();
      ctx.arc(46, s.y, 8, 0, Math.PI * 2);
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

  useProgramConsole({
    main: { label: running ? "FLAP" : "PLAY", pulse: true, onPress: flap },
    status: {
      left: running ? `SCORE ${score}` : "FLAPPY PIPER",
      right: `BEST ${best}`,
    },
  });

  if (!running) {
    return (
      <MinigameBoard
        title="Flappy Piper"
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
