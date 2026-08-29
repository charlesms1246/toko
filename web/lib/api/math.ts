/**
 * Number formatting.
 *
 * This file used to hold the whole simulated pricing model — the volatility
 * curve, the z-score strike ladder, `markToMarket`. All of it is gone: a binary
 * contract's price *is* its implied probability, so the order book prices every
 * game and the payout is simply `1 / price`.
 *
 * What is left is display formatting, which the console still needs.
 */

export const money = (value: number) => value.toFixed(2);

export function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

export function formatUsd(value: number, sign = false): string {
  const prefix = sign && value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}
