"use client";

/**
 * Breakout — call the move, then ride it.
 *
 * The same ladder as Press with the side **locked** to whatever you opened on,
 * so every rung is a bet that the move keeps going. A binary carries direction
 * but not magnitude, so a true breakout — price travelling far in either
 * direction — cannot be bought on this venue; consecutive same-direction
 * windows is the honest version of the call.
 */

import LadderConsole from "@/components/games/LadderConsole";

export default function BreakoutPage() {
  return <LadderConsole title="Breakout" lockSide />;
}
