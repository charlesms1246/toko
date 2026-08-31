"use client";

/**
 * Moonshot — the Round's deep tail.
 *
 * Same instrument as Lucky, but every rung is a long way out of the money, so a
 * fill only happens when the book agrees that side is a heavy underdog. Late in
 * a window one side routinely trades at 2–5 ¢, which is where a real ~25–50x
 * ticket exists — quoted by the market, not invented by a house ladder.
 */

import RoundConsole, { type Rung } from "@/components/games/RoundConsole";

const LADDER: Rung[] = [
  { label: "5x", price: 0.2 },
  { label: "10x", price: 0.1 },
  { label: "25x", price: 0.04 },
  { label: "50x", price: 0.02 },
  { label: "100x", price: 0.01 },
];

export default function MoonshotPage() {
  return <RoundConsole title="Moonshot" ladder={LADDER} />;
}
