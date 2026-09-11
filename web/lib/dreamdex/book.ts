"use client";

/**
 * The order book for one window.
 *
 * A binary pool quotes both outcomes on a single book, and the two sides are
 * complements: a resting YES bid at 0.916 is a NO ask at 0.084. The SDK returns
 * all four ladders already expressed in their own side's terms.
 *
 * Prices and quantities are raw collateral units (6 decimals on testnet), on a
 * 0.001 grid.
 */

import { COLLATERAL } from "./config";
import { getClient } from "./client";
import { createPoller } from "./poller";

const ONE = 10 ** COLLATERAL.decimals;

export interface Level {
  /** 0–1, in this side's own terms. */
  price: number;
  /** Contracts. */
  size: number;
}

export interface Book {
  yesBids: Level[];
  yesAsks: Level[];
  noBids: Level[];
  noAsks: Level[];
}

export const EMPTY_BOOK: Book = { yesBids: [], yesAsks: [], noBids: [], noAsks: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ladder = (levels: any[] | undefined): Level[] =>
  (levels ?? []).map((l) => ({
    price: Number(l.price) / ONE,
    size: Number(l.quantity) / ONE,
  }));

export async function readBook(pool: string, depth = 5): Promise<Book> {
  const client = getClient();
  if (!client) return EMPTY_BOOK;
  const raw = await client.getBinaryOrderBook(pool, { depth });
  return {
    yesBids: ladder(raw.yesBids),
    yesAsks: ladder(raw.yesAsks),
    noBids: ladder(raw.noBids),
    noAsks: ladder(raw.noAsks),
  };
}

/** Best price on a ladder, or null when nothing is resting. */
export const best = (levels: Level[]): Level | null => levels[0] ?? null;

/**
 * What the book says the chance of "up" is, as a mid between the YES bid and
 * ask. Null when one side is empty — in the last couple of seconds of a window
 * the maker pulls its quotes entirely, and an invented mid would be a lie.
 */
export function impliedUp(book: Book): number | null {
  const bid = best(book.yesBids)?.price;
  const ask = best(book.yesAsks)?.price;
  if (bid == null || ask == null) return null;
  return (bid + ask) / 2;
}

/** Payout multiple for buying at `price` — a binary pays 1 per contract. */
export const multipleAt = (price: number) => (price > 0 ? 1 / price : 0);

// ── Watching one book ───────────────────────────────────────────────────────

/**
 * A tiny store for the book currently on screen. Same reason as everywhere else
 * in `lib/dreamdex`: an async read on mount is `set-state-in-effect`, which the
 * React Compiler rules reject, so the state lives outside React.
 */
export interface BookState {
  pool: string | null;
  book: Book;
  loading: boolean;
  error: string | null;
}

const SERVER_STATE: BookState = {
  pool: null,
  book: EMPTY_BOOK,
  loading: false,
  error: null,
};

let bookState: BookState = SERVER_STATE;
const bookListeners = new Set<() => void>();

function setBook(patch: Partial<BookState>) {
  bookState = { ...bookState, ...patch };
  bookListeners.forEach((fn) => fn());
}

export function subscribeBook(fn: () => void) {
  bookListeners.add(fn);
  return () => {
    bookListeners.delete(fn);
  };
}

export const getBookSnapshot = () => bookState;
export const getBookServerSnapshot = () => SERVER_STATE;

const poller = createPoller();

/** Follow one pool's book until told otherwise. */
export function track(pool: string, everyMs = 1500): () => void {
  // `loading` belongs here: the first read for a new pool is the only time the
  // book is genuinely unknown, and the tick below clears the flag either way.
  if (bookState.pool !== pool) {
    setBook({ pool, book: EMPTY_BOOK, error: null, loading: true });
  }

  const tick = async () => {
    try {
      const book = await readBook(pool);
      // A late response for a pool we have moved off must not overwrite.
      if (bookState.pool === pool) setBook({ book, loading: false, error: null });
    } catch (err) {
      if (bookState.pool === pool) {
        setBook({
          loading: false,
          error: err instanceof Error ? err.message : "Could not read the book",
        });
      }
    }
  };

  // Keyed on the pool: the poller replaces the interval when the pool changes,
  // so no interval is left closed over the one we moved off, and refcounts
  // callers on the same pool so the first unmount does not silence the second.
  return poller.track(pool, everyMs, tick);
}
