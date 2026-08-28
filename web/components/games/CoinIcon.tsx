"use client";

import { ASSET_LOGOS } from "@/lib/api/prices";

/** The asset's mark, shown beside its ticker on the console screen. */
export default function CoinIcon({
  asset,
  size = 14,
}: {
  asset: string;
  size?: number;
}) {
  const src = ASSET_LOGOS[asset];
  if (!src) return null;
  return (
    // Plain img: the screen subtree is CSS-scaled, and these are already small
    // fixed-size marks, so the image optimizer has nothing to add.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="inline-block rounded-full align-[-2px]"
      style={{ width: size, height: size }}
    />
  );
}
