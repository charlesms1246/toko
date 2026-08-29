"use client";

/**
 * Live Event Contract windows, straight from Shannon.
 *
 * Nothing here is derived from a model: the countdown is the market's real
 * expiry, the Up/Down prices are the resting book, and the underlying is the
 * on-chain EMA oracle.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { MenuSection, StatTile } from "@/components/menu/MenuUI";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import * as markets from "@/lib/dreamdex/markets";
import * as book from "@/lib/dreamdex/book";

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

export default function MarketsPage() {
  const now = useNow();
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

  useEffect(() => markets.startPolling(), []);

  const focused = markets.nextToClose(windows, ONE_MINUTE) ?? markets.nextToClose(windows);
  const pool = focused?.poolAddress;

  useEffect(() => {
    if (pool) return book.track(pool);
  }, [pool]);

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
