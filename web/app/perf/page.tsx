"use client";

/** Frame-time and memory sampling for the live console scene. */

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/shell/Panel";
import { MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useRequireAdmin } from "@/lib/games/lab";

interface Sample {
  fps: number;
  frameMs: number;
}

export default function PerfPage() {
  const admin = useRequireAdmin();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [heapMb, setHeapMb] = useState<number | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames += 1;
      elapsed += dt;

      if (elapsed >= 500) {
        const fps = (frames * 1000) / elapsed;
        setSamples((prev) => [
          ...prev.slice(-59),
          { fps, frameMs: elapsed / frames },
        ]);
        frames = 0;
        elapsed = 0;

        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number };
        };
        if (perf.memory) {
          setHeapMb(perf.memory.usedJSHeapSize / 1048576);
        }
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const latest = samples[samples.length - 1];
  const avg = samples.length
    ? samples.reduce((s, x) => s + x.fps, 0) / samples.length
    : 0;
  const min = samples.length ? Math.min(...samples.map((s) => s.fps)) : 0;
  const maxFps = Math.max(60, ...samples.map((s) => s.fps));

  return (
    <Panel
      title="Perf"
      backHref="/admin"
      screenLabel="Perf"
    >
      {!admin ? (
        <p className="py-10 text-center text-sm text-text-3">
          Admin access only.
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2">
            <StatTile
              label="FPS"
              value={latest ? latest.fps.toFixed(0) : "—"}
              tone={latest && latest.fps > 50 ? "up" : "down"}
            />
            <StatTile
              label="Frame"
              value={latest ? `${latest.frameMs.toFixed(1)}ms` : "—"}
            />
            <StatTile label="Average" value={avg.toFixed(0)} />
            <StatTile
              label="Worst"
              value={min.toFixed(0)}
              tone={min > 45 ? "up" : "down"}
            />
          </div>

          <MenuSection title="Last 30 seconds">
            <div className="flex h-24 items-end gap-[2px] p-3">
              {samples.map((sample, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm ${
                    sample.fps > 50
                      ? "bg-up"
                      : sample.fps > 30
                        ? "bg-brand-500"
                        : "bg-down"
                  }`}
                  style={{ height: `${(sample.fps / maxFps) * 100}%` }}
                />
              ))}
            </div>
          </MenuSection>

          <MenuSection title="Memory">
            <div className="px-4 py-3.5 text-sm">
              {heapMb == null ? (
                <span className="text-text-3">
                  JS heap size is not exposed by this browser.
                </span>
              ) : (
                <span className="font-bold tabular-nums">
                  {heapMb.toFixed(1)} MB JS heap
                </span>
              )}
            </div>
          </MenuSection>
        </>
      )}
    </Panel>
  );
}
