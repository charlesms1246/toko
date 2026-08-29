"use client";

/**
 * Lucky — the Minute at everyday odds.
 *
 * The knob's rungs sit near the middle of the book, so they fill readily. See
 * `components/games/MinuteConsole` for the mechanic.
 */

import MinuteConsole, { type Rung } from "@/components/games/MinuteConsole";

const LADDER: Rung[] = [
  { label: "MKT", price: null },
  { label: "2x", price: 0.5 },
  { label: "3x", price: 0.33 },
  { label: "5x", price: 0.2 },
  { label: "10x", price: 0.1 },
];

export default function LuckyPage() {
  return <MinuteConsole title="Lucky" ladder={LADDER} />;
}
