"use client";

/**
 * Live Event Contract windows, straight from Shannon.
 *
 * Nothing here is derived from a model: the countdown is the market's real
 * expiry, the Up/Down prices are the resting book, and the underlying is the
 * on-chain EMA oracle.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MenuSection, StatTile } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import { useToast } from "@/components/ui/Toast";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import { COLLATERAL, explorerTx } from "@/lib/dreamdex/config";
import * as markets from "@/lib/dreamdex/markets";
import * as book from "@/lib/dreamdex/book";
import * as orders from "@/lib/dreamdex/orders";
import * as positions from "@/lib/dreamdex/positions";
import * as wallet from "@/lib/dreamdex/wallet";

const ONE_MINUTE = 60;

/** A clock that ticks for the countdowns, kept out of render to stay pure. */
function useNow(everyMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * Slippage allowance on a taker order, in price terms.
 *
 * Not cosmetic: a round trip is ~3 seconds (and the first trade from a wallet
 * adds an `approve` leg before it), during which a binary price late in its
 * window moves fast. Crossing by a tick or two reads as "aggressive" and then
 * misses, reverting `ImmediateOrCancelNoFill` — observed on chain. 0.02 is a
 * 2 ¢ tolerance, clamped into `(0, 1)` by `orders.snapPrice`.
 */
const SLIPPAGE = 0.02;

export default function MarketsPage() {
  const now = useNow();
  const toast = useToast();
  const [size, setSize] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const { windows, error } = useSyncExternalStore(
    markets.subscribe,
    markets.getSnapshot,
    markets.getServerSnapshot,
  );
  const bookState = useSyncExternalStore(
    book.subscribeBook,
    book.getBookSnapshot,
    book.getBookServerSnapshot,
  );
  const holdingState = useSyncExternalStore(
    positions.subscribe,
    positions.getSnapshot,
    positions.getServerSnapshot,
  );
  const walletState = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  useEffect(() => markets.startPolling(), []);

  const focused = markets.nextToClose(windows, ONE_MINUTE) ?? markets.nextToClose(windows);
  const pool = focused?.poolAddress;

  useEffect(() => {
    if (pool) return book.track(pool);
  }, [pool]);

  useEffect(() => {
    wallet.ensureWallet();
    void wallet.refresh();
  }, []);

  useEffect(() => {
    if (focused) return positions.track(focused);
    // Only the identity of the window matters, not the object it arrived in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused?.marketId]);

  const settle = useCallback(
    async (
      label: string,
      side: orders.Side,
      run: () => Promise<orders.OrderOutcome>,
    ) => {
      setBusy(true);
      const result = await run();
      setBusy(false);
      if (result.ok) {
        setLastTx(result.hash ?? null);
        // `fillPrice` is the YES price on every side — show it in the side's own
        // terms or a DOWN fill at 0.969 reads as 0.031.
        const shown =
          result.fillPrice == null
            ? "?"
            : (side === "up"
                ? orders.fromRaw(result.fillPrice)
                : 1 - orders.fromRaw(result.fillPrice)
              ).toFixed(3);
        toast(
          `${label} ${orders.fromRaw(result.filled).toFixed(3)} @ ${shown}`,
          "win",
        );
        void positions.refresh();
        void wallet.refresh();
        return;
      }
      if (result.noLiquidity) toast("Nobody on the other side right now", "lose");
      else toast(result.error ?? "Order failed", "lose");
    },
    [toast],
  );

  const spot = useSpot(focused?.asset ?? "BTC");
  const up = book.impliedUp(bookState.book);
  const yesAsk = book.best(bookState.book.yesAsks);
  const noAsk = book.best(bookState.book.noAsks);

  const left = focused ? Math.max(0, focused.expiry - now / 1000) : 0;

  return (
    <>
      {error && (
        <p className="mb-4 rounded-2xl border border-[var(--color-line)] px-4 py-3 text-[11px] text-down">
          {error}
        </p>
      )}

      {!focused ? (
        <p className="px-1 py-10 text-center text-sm text-text-3">
          Reading live windows…
        </p>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-[var(--color-line)] bg-white/[.03] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
                {focused.asset} · {focused.interval}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
                {focused.status}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-black tabular-nums">
                {left.toFixed(1)}s
              </span>
              <span className="text-sm font-bold text-text-3">to close</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-text-3">Spot</span>
                <span className="font-bold tabular-nums">
                  {spot > 0 ? `$${formatPrice(spot)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-3">Strike</span>
                <span className="font-bold tabular-nums">
                  {focused.strike != null
                    ? `$${markets.formatStrike(focused.strike)}`
                    : "not stamped"}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2">
            <StatTile
              label="Implied up"
              value={up != null ? `${(up * 100).toFixed(1)}%` : "—"}
              tone="brand"
            />
            <StatTile
              label="Up pays"
              value={yesAsk ? `${book.multipleAt(yesAsk.price).toFixed(2)}x` : "—"}
              tone="up"
            />
            <StatTile
              label="Down pays"
              value={noAsk ? `${book.multipleAt(noAsk.price).toFixed(2)}x` : "—"}
              tone="down"
            />
          </div>

          <MenuSection title={`Trade · ${walletState.ready ? wallet.formatCollateral(walletState.collateral) : "—"} ${COLLATERAL.symbol}`}>
            <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-3">
                Size
              </span>
              <input
                inputMode="decimal"
                value={size}
                onChange={(e) => setSize(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
                className="w-20 bg-transparent text-sm font-bold tabular-nums outline-none"
              />
              <span className="flex-1 text-[11px] text-text-3">contracts</span>
              <span className="text-[11px] text-text-3">
                held {positions.contracts(holdingState.holding.up).toFixed(2)} up ·{" "}
                {positions.contracts(holdingState.holding.down).toFixed(2)} down
              </span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-[var(--color-line)]">
              <TapTarget
                haptic="high"
                disabled={busy || !yesAsk || size <= 0}
                className="bg-[#0b0b0d] py-4 text-sm font-extrabold text-up disabled:opacity-40"
                onClick={() =>
                  yesAsk &&
                  void settle("Bought up", "up", () =>
                    orders.buy(
                      focused,
                      "up",
                      orders.toRawPrice(yesAsk.price + SLIPPAGE),
                      orders.toRawSize(size),
                    ),
                  )
                }
              >
                {busy ? "…" : `BUY UP${yesAsk ? ` ${yesAsk.price.toFixed(3)}` : ""}`}
              </TapTarget>
              <TapTarget
                haptic="high"
                disabled={busy || !noAsk || size <= 0}
                className="bg-[#0b0b0d] py-4 text-sm font-extrabold text-down disabled:opacity-40"
                onClick={() =>
                  noAsk &&
                  void settle("Bought down", "down", () =>
                    orders.buy(
                      focused,
                      "down",
                      // Buying DOWN sends a YES price; lower is more aggressive.
                      orders.toRawPrice(1 - noAsk.price - SLIPPAGE),
                      orders.toRawSize(size),
                    ),
                  )
                }
              >
                {busy ? "…" : `BUY DOWN${noAsk ? ` ${noAsk.price.toFixed(3)}` : ""}`}
              </TapTarget>
            </div>

            {(holdingState.holding.up > 0n || holdingState.holding.down > 0n) && (
              <div className="grid grid-cols-2 gap-px border-t border-[var(--color-line)] bg-[var(--color-line)]">
                <TapTarget
                  disabled={busy || holdingState.holding.up === 0n || !book.best(bookState.book.yesBids)}
                  className="bg-[#0b0b0d] py-3 text-[11px] font-bold text-text-2 disabled:opacity-30"
                  onClick={() => {
                    const bid = book.best(bookState.book.yesBids);
                    if (!bid) return;
                    void settle("Sold up", "up", () =>
                      orders.sell(
                        focused,
                        "up",
                        orders.toRawPrice(bid.price - SLIPPAGE),
                        holdingState.holding.up,
                      ),
                    );
                  }}
                >
                  SELL UP
                </TapTarget>
                <TapTarget
                  disabled={busy || holdingState.holding.down === 0n || !book.best(bookState.book.noBids)}
                  className="bg-[#0b0b0d] py-3 text-[11px] font-bold text-text-2 disabled:opacity-30"
                  onClick={() => {
                    const bid = book.best(bookState.book.noBids);
                    if (!bid) return;
                    void settle("Sold down", "down", () =>
                      orders.sell(
                        focused,
                        "down",
                        // Selling DOWN accepts a lower NO price = a higher YES price.
                        orders.toRawPrice(1 - bid.price + SLIPPAGE),
                        holdingState.holding.down,
                      ),
                    );
                  }}
                >
                  SELL DOWN
                </TapTarget>
              </div>
            )}

            {lastTx && (
              <a
                href={explorerTx(lastTx)}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-[var(--color-line)] px-4 py-3 text-[11px] text-text-3"
              >
                Last fill {lastTx.slice(0, 14)}… ↗
              </a>
            )}
          </MenuSection>

          <MenuSection title="Order book">
            <div className="grid grid-cols-2 gap-px bg-[var(--color-line)]">
              <div className="bg-[#0b0b0d] p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-up">
                  Up
                </div>
                {bookState.book.yesAsks.length === 0 ? (
                  <p className="text-[11px] text-text-3">no offers</p>
                ) : (
                  bookState.book.yesAsks.map((level) => (
                    <div
                      key={`u${level.price}`}
                      className="flex justify-between text-[11px] tabular-nums"
                    >
                      <span className="text-up">{level.price.toFixed(3)}</span>
                      <span className="text-text-3">{level.size.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-[#0b0b0d] p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-down">
                  Down
                </div>
                {bookState.book.noAsks.length === 0 ? (
                  <p className="text-[11px] text-text-3">no offers</p>
                ) : (
                  bookState.book.noAsks.map((level) => (
                    <div
                      key={`d${level.price}`}
                      className="flex justify-between text-[11px] tabular-nums"
                    >
                      <span className="text-down">{level.price.toFixed(3)}</span>
                      <span className="text-text-3">{level.size.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </MenuSection>
        </>
      )}

      <MenuSection title={`All live windows (${windows.length})`}>
        {windows.map((w) => {
          const secs = Math.max(0, w.expiry - now / 1000);
          return (
            <div
              key={w.marketId}
              className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0"
            >
              <span className="w-12 text-sm font-bold">{w.asset}</span>
              <span className="w-10 text-[11px] text-text-3">{w.interval}</span>
              <span className="flex-1 truncate text-[11px] text-text-3">
                {w.strike != null ? `$${markets.formatStrike(w.strike)}` : "—"}
              </span>
              <span
                className={`text-sm font-black tabular-nums ${
                  secs < 10 ? "text-down" : "text-text-2"
                }`}
              >
                {secs < 60 ? `${secs.toFixed(0)}s` : `${Math.floor(secs / 60)}m`}
              </span>
            </div>
          );
        })}
      </MenuSection>
    </>
  );
}
