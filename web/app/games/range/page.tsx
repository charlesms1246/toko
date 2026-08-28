"use client";

/**
 * Range — stay inside the band.
 *
 * The knob picks one of seven tiers; tighter band, bigger multiple. Rounds are
 * synchronised to the wall-clock minute, which is why there is only one action
 * (no direction) and why a live round is never restored across pages.
 */

import { useState } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import Sparkline from "@/components/games/Sparkline";
import CoinIcon from "@/components/games/CoinIcon";
import { useGameRound } from "@/lib/games/useGameRound";
import {
  useBalance,
  usePriceHistory,
  useSpot,
  useRangeQuotes,
  useStakeIndex,
  useStoreActions,
} from "@/lib/api/hooks";
import { TIER_PROBS, formatPrice, formatUsd } from "@/lib/api/math";
import { TRADABLE_ASSETS } from "@/lib/api/prices";

export default function RangePage() {
  const [asset, setAsset] = useState(TRADABLE_ASSETS[0]);
  const [tier, setTier] = useState(2);

  const price = useSpot(asset);
  const points = usePriceHistory(asset);
  const balance = useBalance();
  const { ladder, index: stakeIndex, stake, set: setStakeIndex } = useStakeIndex();
  const actions = useStoreActions();
  const round = useGameRound("range");
  const { play, live, settled, secsLeft, progress } = round;

  const quotes = useRangeQuotes(asset);
  const quote = quotes[tier];

  const lower = play?.market.lower ? Number(play.market.lower) : quote.lower;
  const upper = play?.market.upper ? Number(play.market.upper) : quote.upper;
  const inside = price >= lower && price <= upper;

  const markValue = play ? Number(play.markValue) : 0;
  const pnl = play ? Number(play.pnl) : 0;
  const multiplier = play?.multiplier ?? quote.multiplier;

  useProgramConsole({
    main: live
      ? {
          label: "CASH OUT",
          pulse: true,
          loading: play?.status === "pending",
          onPress: round.cashOut,
        }
      : {
          label: "PLAY",
          pulse: true,
          onPress: () =>
            round.open(() => actions.openRange({ asset, stake, tier })),
        },
    knob: {
      min: 0,
      max: TIER_PROBS.length - 1,
      step: 1,
      value: tier,
      label: "ZONE",
      format: (v) => `${quotes[v].multiplier.toFixed(2)}x`,
      onChange: (v) => !live && setTier(v),
    },
    numberWheel: {
      min: 0,
      max: ladder.length - 1,
      step: 1,
      value: stakeIndex,
      label: "USDC",
      format: (v) => `$${ladder[v]}`,
      onChange: (v) => !live && setStakeIndex(v),
    },
    status: {
      left: live ? `${secsLeft}s` : "RANGE",
      right: `$${balance.toFixed(2)}`,
    },
    lightShow: settled,
  });

  if (settled && play) {
    const won = play.status === "won" || play.status === "cashed_out";
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {play.status === "cashed_out"
            ? "Cashed out"
            : won
              ? "Held the band"
              : "Broke out"}
        </div>
        <BigNumber value={formatUsd(pnl, true)} tone={won ? "up" : "down"} />
        <div className="text-[11px] font-semibold text-text-2">
          {multiplier.toFixed(2)}x · {asset}
        </div>
      </ScreenRoot>
    );
  }

  return (
    <ScreenRoot className="gap-1.5">
      <ScreenHeader
        left={live ? `${asset} BAND` : "Range"}
        right={live ? `${secsLeft}s` : `$${stake}`}
      />

      {live ? (
        <BigNumber
          value={formatUsd(markValue)}
          tone={inside ? "up" : "down"}
        />
      ) : (
        <div className="flex items-baseline justify-between">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-black tracking-tight text-text"
            onClick={() =>
              setAsset(
                TRADABLE_ASSETS[
                  (TRADABLE_ASSETS.indexOf(asset) + 1) % TRADABLE_ASSETS.length
                ],
              )
            }
          >
            <CoinIcon asset={asset} />
            {asset}
          </button>
          <span className="text-sm font-bold tabular-nums text-text-2">
            ${formatPrice(price)}
          </span>
        </div>
      )}

      <Sparkline
        points={points}
        height={56}
        tone={inside ? "up" : "down"}
        band={{
          lower,
          upper,
          color: inside ? "var(--color-up)" : "var(--color-down)",
        }}
        markers={[
          { price: upper, color: "var(--color-line-strong)" },
          { price: lower, color: "var(--color-line-strong)" },
        ]}
      />

      <ScreenRow label="Upper" value={formatPrice(upper)} />
      <ScreenRow label="Lower" value={formatPrice(lower)} />
      {live ? (
        <>
          <ScreenRow
            label={inside ? "Inside" : "Outside"}
            value={formatUsd(pnl, true)}
            tone={inside ? "up" : "down"}
          />
          <ScreenBar progress={progress} />
        </>
      ) : (
        <>
          <ScreenRow
            label={`Tier ${tier + 1}`}
            value={`${multiplier.toFixed(2)}x`}
            tone="brand"
          />
          <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
            {(quote.probability * 100).toFixed(0)}% to hold
          </div>
        </>
      )}
    </ScreenRoot>
  );
}
