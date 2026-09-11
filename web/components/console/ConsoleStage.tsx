"use client";

/**
 * The persistent shell.
 *
 * The console lives here, above every route, so navigating between games never
 * rebuilds the WebGL scene. Routes program the hardware through
 * `ConsoleControls`; this component translates those controls into key glow,
 * knob/thumbwheel behaviour, and routes key presses back out — including the
 * two fixed pill keys, which always navigate.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import ConsoleCanvas from "./ConsoleCanvas";
import { useConsoleTheme } from "@/lib/console/theme-context";
import { ambientFor } from "@/lib/console/themes";
import { useConsoleControls } from "@/lib/console/controls";
import type { ButtonKey } from "@/lib/console/geometry";
import haptics from "@/lib/haptics";
import * as onboarding from "@/lib/onboarding";
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

  /**
   * The landing pitch sits under the console, so the device has to be framed
   * above it. Read here rather than passed down because `ConsoleStage` is the
   * only thing that owns the camera.
   */
  const { onboarded } = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getServerSnapshot,
  );
  const landing = !onboarded;
  /**
   * The landing presents the console as an object: it sits at a slight angle and
   * drifts, the way the reference's does. Both are CSS on the layer that holds
   * the canvas AND the screen, so they move as one thing.
   */
  const float = landing;
  const tiltDeg = landing ? -2.4 : 0;

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
    /**
     * A DISABLED key is unlit, the same as an unassigned one.
     *
     * Existing and being pressable are different things, and only the second
     * should glow. Snipe made this obvious: its right cap is a deliberately
     * inert asset readout, and because a non-null control meant "this key
     * exists" it came out lit while the genuinely idle cap beside it stayed
     * dull — the one key you cannot press looked like the one you should.
     */
    const on = (c: { pulse?: boolean; disabled?: boolean } | null, lit: number, dim: number) =>
      !c || c.disabled ? 0 : c.pulse ? lit : dim;

    return {
      play: controls.main && !controls.main.disabled
        ? controls.main.pulse
          ? 0.9
          : 0.34
        : 0.1,
      action1: on(controls.action1, 0.85, 0.28),
      action2: on(controls.action2, 0.85, 0.28),
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

      {/*
        ONE LAYER FOR THE DEVICE AND ITS SCREEN.
        
        The canvas and the DOM screen are wrapped together so any drift or angle
        can be a CSS transform on their COMMON ancestor. That is the only way the
        two stay registered while moving: transforming the device in 3D and
        re-projecting the screen rect each frame leaves a frame of lag between
        the GL buffer and the style write, which reads as the black glass sliding
        out of its bezel. As one composited layer they cannot disagree.
        
        Two nested elements because the angle is static and the drift is an
        animation, and a keyframe transform would overwrite an inline one.
      */}
      <div
        className="console-device-tilt"
        style={{ transform: `rotate(${tiltDeg}deg)` }}
      >
        <div className="console-device-float" data-float={float ? "true" : "false"}>
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
          actionDisplays={{
            action1: controls.action1?.display ?? null,
            action2: controls.action2?.display ?? null,
          }}
          // A key the screen has not programmed is unlit hardware, not a
          // button with a missing label.
          dimKeys={{
            play: !controls.main || !!controls.main.disabled,
            action1: !controls.action1 || !!controls.action1.disabled,
            action2: !controls.action2 || !!controls.action2.disabled,
          }}
          // Two screens put a panel under the console and make the device the
          // subject rather than the frame: the customizer, and the landing,
          // where the pitch and START sit below it. Both need the machine
          // framed into the band above — otherwise the copy lands on top of the
          // keys and the device is cropped to just its screen.
          bottomInset={
            pathname === "/menu/customize" ? 0.46 : landing ? 0.42 : 0
          }
          // The customizer is the one place the device turns: it is the thing
          // being examined, so the pointer moves it. The landing is not — the
          // console is presenting itself there and should face the viewer
          // square, so it drifts instead of leaning.
          lean={pathname === "/menu/customize"}
          // Turned, so the side wall, the seam and the depth of every part you
          // are recolouring are all visible. Face-on hides exactly what the
          // customizer is for.
          restAngle={pathname === "/menu/customize" ? [-0.38, 0.06] : undefined}
          wheelSlots={wheel?.slots}
          wheelIndex={wheel?.index ?? 0}
          onPress={handlePress}
          onKnobStep={(steps) => stepDial("knob", steps)}
          onWheelStep={(steps) => stepDial("numberWheel", steps)}
          idle={!controls.main}
        />
          </div>
        </div>
      </div>

      {/*
        No status caption on the chin.
        
        It printed a live asset, a ticking countdown and a balance in the
        silkscreen ink, next to MENU and HOME — and everything else on that
        surface is moulded and never changes, so live data there read as a
        sticker on the plastic rather than part of the machine. It was also
        redundant: every figure it carried is on the glass, the balance now
        included. The reference reserves the chin for MENU, HOME and the PRESS
        START marquee, and nothing else.
      */}
    </div>
  );
}
