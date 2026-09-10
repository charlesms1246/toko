"use client";

/**
 * The persistent shell.
 *
 * The console lives here, above every route, so navigating between games never
 * rebuilds the WebGL scene. Routes program the hardware through
 * `ConsoleControls`; this component translates those controls into key glow,
 * knob/thumbwheel behaviour and the status caption, and routes key presses back
 * out — including the two fixed pill keys, which always navigate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConsoleCanvas from "./ConsoleCanvas";
import { useConsoleTheme } from "@/lib/console/theme-context";
import { ambientFor } from "@/lib/console/themes";
import { useConsoleControls } from "@/lib/console/controls";
import type { ButtonKey } from "@/lib/console/geometry";
import haptics from "@/lib/haptics";
import { playKeyPress, playKeyRelease, type Voice } from "@/lib/sound";

const VOICE: Record<ButtonKey, Voice> = {
  play: "main",
  action1: "action1",
  action2: "action2",
  menu: "menu",
  home: "home",
};

export default function ConsoleStage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolved } = useConsoleTheme();
  const ambient = ambientFor(resolved);
  const { controls, press: broadcast } = useConsoleControls();
  const router = useRouter();
  const pathname = usePathname();
  const screenRef = useRef<HTMLDivElement>(null);

  const [lightPhase, setLightPhase] = useState(0);

  // Light show sweeps the keys while a round is settling. The phase keeps
  // counting rather than resetting, since it is only read modulo the key count.
  useEffect(() => {
    if (!controls.lightShow) return;
    const timer = setInterval(() => setLightPhase((p) => p + 1), 140);
    return () => clearInterval(timer);
  }, [controls.lightShow]);

  const keyGlow = useMemo(() => {
    if (controls.lightShow) {
      const order: ButtonKey[] = ["play", "action1", "action2", "menu", "home"];
      const lit = order[lightPhase % order.length];
      return Object.fromEntries(
        order.map((k) => [k, k === lit ? 1 : 0.12]),
      ) as Partial<Record<ButtonKey, number>>;
    }
    return {
      play: controls.main ? (controls.main.pulse ? 0.9 : 0.34) : 0.1,
      action1: controls.action1 ? (controls.action1.pulse ? 0.85 : 0.28) : 0,
      action2: controls.action2 ? (controls.action2.pulse ? 0.85 : 0.28) : 0,
      menu: 0.1,
      home: 0.1,
    };
  }, [controls, lightPhase]);

  const handlePress = useCallback(
    (key: ButtonKey) => {
      playKeyPress(VOICE[key]);
      window.setTimeout(() => playKeyRelease(VOICE[key]), 90);

      // The pill keys are hardware — they always navigate.
      if (key === "menu") {
        haptics.press("medium");
        router.push(pathname.startsWith("/menu") ? "/games" : "/menu");
        return;
      }
      if (key === "home") {
        haptics.press("medium");
        router.push("/games");
        return;
      }

      const control =
        key === "play"
          ? controls.main
          : key === "action1"
            ? controls.action1
            : controls.action2;

      if (!control || control.disabled || control.loading) {
        haptics.press("warning");
        broadcast(key);
        return;
      }

      haptics.press(key === "play" ? "high" : "medium");
      control.onPress?.();
      broadcast(key);
    },
    [controls, router, pathname, broadcast],
  );

  const stepDial = useCallback(
    (which: "knob" | "numberWheel", steps: number) => {
      const dial = which === "knob" ? controls.knob : controls.numberWheel;
      if (!dial) return;
      const next = Math.max(
        dial.min,
        Math.min(dial.max, dial.value + steps * dial.step),
      );
      if (next === dial.value) return;
      haptics.detent();
      dial.onChange?.(next);
    },
    [controls],
  );

  const status = controls.status;

  /**
   * The thumbwheel's detents, formatted, so the drum can print them.
   *
   * The dial is an index range with a `format`, so the slots are just that range
   * walked. Capped because the drum has to stay legible: a wheel with dozens of
   * detents is a knob, and printing it would produce a blur rather than a
   * readout. Above the cap the drum stays bare rather than lying.
   */
  const wheel = useMemo(() => {
    const dial = controls.numberWheel;
    if (!dial || !dial.format || dial.step <= 0) return null;
    const count = Math.round((dial.max - dial.min) / dial.step) + 1;
    if (count < 2 || count > 12) return null;
    return {
      slots: Array.from({ length: count }, (_, i) =>
        dial.format!(dial.min + i * dial.step),
      ),
      index: Math.round((dial.value - dial.min) / dial.step),
    };
  }, [controls.numberWheel]);

  return (
    <div className="console-stage" style={{ background: ambient }}>
      <div
        className={`toko-surround ${
          controls.lightShow ? "toko-surround-dim" : ""
        }`}
        style={{ opacity: 0.55 }}
      />
      {/* Ambient wash + vignette, tinted by the current console theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 82% at 50% 34%, ${ambient}00 0%, ${ambient}cc 58%, #06060899 100%)`,
        }}
      />

      {/* The screen is real DOM, positioned each frame by the canvas. */}
      <div
        ref={screenRef}
        className="console-screen-surface absolute overflow-hidden"
        style={{ zIndex: 1, borderRadius: 10 }}
      >
        <div className="console-screen-content" data-visible="true">
          {children}
        </div>
      </div>

      <div className="absolute inset-0" style={{ zIndex: 10 }}>
        <ConsoleCanvas
          theme={resolved}
          screenElRef={screenRef}
          keyGlow={keyGlow}
          actionLabels={{
            action1: controls.action1?.label,
            action2: controls.action2?.label,
          }}
          mainLabel={controls.main?.label}
          wheelSlots={wheel?.slots}
          wheelIndex={wheel?.index ?? 0}
          onPress={handlePress}
          onKnobStep={(steps) => stepDial("knob", steps)}
          onWheelStep={(steps) => stepDial("numberWheel", steps)}
          idle={!controls.main}
        />
      </div>

      {status && (
        <div
          className="pointer-events-none absolute flex justify-between text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{
            zIndex: 12,
            // The chin is body-coloured and most presets are light, so the
            // caption takes the theme's own silkscreen ink rather than white.
            color: resolved.label,
            opacity: 0.75,
            // On the hardware, not on the page. Anchored to the projected
            // device rect so it stays on the console's chin at any size —
            // pinned to the viewport it slid off the bottom of a phone.
            left: "calc(var(--device-left, 0px) + 7%)",
            right: "calc(var(--device-right, 0px) + 7%)",
            bottom: "calc(var(--device-bottom, 0px) + 0.7%)",
          }}
        >
          <span>{status.left}</span>
          <span>{status.right}</span>
        </div>
      )}
    </div>
  );
}
