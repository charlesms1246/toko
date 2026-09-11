"use client";

/**
 * Lucky — the Round, at whatever odds you ask for.
 *
 * One knob spans the book, from taking the market price out to the deep tail
 * where a side trades at a cent or two. The near rungs fill readily; the far
 * ones fill only when the book agrees that side is a heavy underdog, which is
 * what makes them long shots. See `components/games/RoundConsole` for the
 * mechanic.
 *
 * Each rung is the price that pays its label: a binary redeems for 1, so asking
 * for 3x is bidding a third. The pool snaps a bid down onto its own tick grid,
 * which can only round the multiple up, never below what the label promises.
 */

import RoundConsole, { type Rung } from "@/components/games/RoundConsole";

const LADDER: Rung[] = [
  { label: "MKT", price: null },
  { label: "2x", price: 0.5 },
  { label: "3x", price: 1 / 3 },
  { label: "5x", price: 0.2 },
  { label: "10x", price: 0.1 },
  { label: "25x", price: 0.04 },
  { label: "50x", price: 0.02 },
  { label: "100x", price: 0.01 },
];

export default function LuckyPage() {
  return <RoundConsole title="Lucky" ladder={LADDER} />;
}
