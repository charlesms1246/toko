"use client";

/**
 * Lucky — the Round at everyday odds.
 *
 * The knob's rungs sit near the middle of the book, so they fill readily. See
 * `components/games/RoundConsole` for the mechanic.
 */

import RoundConsole, { type Rung } from "@/components/games/RoundConsole";

const LADDER: Rung[] = [
  { label: "MKT", price: null },
  { label: "2x", price: 0.5 },
  { label: "3x", price: 0.33 },
  { label: "5x", price: 0.2 },
  { label: "10x", price: 0.1 },
];

export default function LuckyPage() {
  return <RoundConsole title="Lucky" ladder={LADDER} />;
}
