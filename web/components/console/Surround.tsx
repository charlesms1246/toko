"use client";

/**
 * The tiled backdrop — wallpaper for the surface the console sits on.
 *
 * It lives OUTSIDE `.app-frame`, which is the whole point. It used to sit inside
 * `.console-stage`, and that was right until the frame existed: the stage was
 * the page, so a backdrop inside it was the page's backdrop. Once the app became
 * a column the stage moved inside the phone, and the pattern went with it —
 * quietly turning from wallpaper into lining, tiled across the letterbox bands
 * of a device whose own body is supposed to be plain. The reference has always
 * had it on this side, and hidden below the breakpoint where there is no column
 * to sit around.
 *
 * A client component only because the light show dims it.
 */

import { useConsoleControls } from "@/lib/console/controls";

export default function Surround() {
  const { controls } = useConsoleControls();

  return (
    <div
      aria-hidden
      className={`toko-surround ${controls.lightShow ? "toko-surround-dim" : ""}`}
    />
  );
}
