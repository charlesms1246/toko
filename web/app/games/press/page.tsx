"use client";

/**
 * Press — clear a rung, then press your winnings on, or fold.
 *
 * A free ladder: each rung is a real Round staked with the last one's
 * payout, and you choose the side afresh every time.
 */

import LadderConsole from "@/components/games/LadderConsole";

export default function PressPage() {
  return <LadderConsole title="Press" />;
}
