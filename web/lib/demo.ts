"use client";

/**
 * Demo Mode — the one place this app is allowed to be hypothetical.
 *
 * It exists so someone can hold the console and trade a live market before they
 * have a wallet, a key, or any funds. It ends the moment they onboard: after
 * that everything is real, with no exceptions.
 *
 * What stays real, which is nearly everything: the live order book at real
 * depth, real windows and countdowns, the real oracle price feed, and real
 * settlement — a demo position wins or loses on the same oracle result as
 * everyone else's.
 *
 * What is hypothetical: only the player's own fills, and they are priced by
 * walking the **actual** book that was there at the moment they pressed. Never
 * an idealised number. A demo that flatters you teaches expectations the real
 * product then breaks.
 *
 * What it never does: claim anything happened on chain. No transaction hashes,
 * no explorer links, no rows in the real activity list, and no paper P&L in the
 * real leaderboard.
 */

const MODE_KEY = "toko_demo_mode_v1";
const LEDGER_KEY = "toko_demo_ledger_v1";
/** What a finished demo run left behind, for the conversion moment. */
const PAST_KEY = "toko_demo_past_v1";

/** Hypothetical opening balance, in collateral units. Labelled everywhere. */
export const OPENING_BALANCE = 100n * 1_000_000n;

export interface Ledger {
  /** Hypothetical collateral, raw. */
  balance: bigint;
  /** Contracts held, keyed `${marketId}:${0|1}`. */
  positions: Record<string, bigint>;
  /** Resting paper bids, keyed by market. */
  resting: Record<string, { side: "up" | "down"; yesPrice: number; size: bigint }>;
  /** Rounds settled in demo, for the conversion moment. */
  rounds: number;
  /** Best single round result, raw and signed. */
  bestRound: bigint;
}

export interface DemoState {
  active: boolean;
  ledger: Ledger;
}

const emptyLedger = (): Ledger => ({
  balance: OPENING_BALANCE,
  positions: {},
  resting: {},
  rounds: 0,
  bestRound: 0n,
});

const SERVER_STATE: DemoState = { active: false, ledger: emptyLedger() };

let state: DemoState = SERVER_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

/** True when the console is standing in for a wallet the player does not have. */
export const isActive = () => state.active;

// ── Persistence ─────────────────────────────────────────────────────────────

/**
 * bigints do not survive `JSON.stringify`, so amounts are written as strings.
 * Persisting a paper ledger is fine — it is the player's own hypothetical
 * record, not data pretending to come from somewhere else — and keeping it
 * means the app is not empty when they decide to fund a wallet.
 */
function persist() {
  if (typeof window === "undefined" || !state.active) return;
  try {
    const l = state.ledger;
    window.localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify({
        balance: l.balance.toString(),
        positions: Object.fromEntries(
          Object.entries(l.positions).map(([k, v]) => [k, v.toString()]),
        ),
        resting: Object.fromEntries(
          Object.entries(l.resting).map(([k, v]) => [k, { ...v, size: v.size.toString() }]),
        ),
        rounds: l.rounds,
        bestRound: l.bestRound.toString(),
      }),
    );
  } catch {
    // storage unavailable — the demo just will not survive a reload
  }
}

export function hydrate() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  try {
    const active = window.localStorage.getItem(MODE_KEY) === "1";
    if (!active) return;
    const raw = window.localStorage.getItem(LEDGER_KEY);
    const ledger = emptyLedger();
    if (raw) {
      const saved = JSON.parse(raw);
      ledger.balance = BigInt(saved.balance ?? OPENING_BALANCE);
      ledger.positions = Object.fromEntries(
        Object.entries(saved.positions ?? {}).map(([k, v]) => [k, BigInt(v as string)]),
      );
      ledger.resting = Object.fromEntries(
        Object.entries(saved.resting ?? {}).map(([k, v]) => {
          const r = v as { side: "up" | "down"; yesPrice: number; size: string };
          return [k, { side: r.side, yesPrice: r.yesPrice, size: BigInt(r.size) }];
        }),
      );
      ledger.rounds = Number(saved.rounds ?? 0);
      ledger.bestRound = BigInt(saved.bestRound ?? 0);
    }
    state = { active: true, ledger };
  } catch {
    state = { active: true, ledger: emptyLedger() };
  }
  emit();
}

// ── Entering and leaving ────────────────────────────────────────────────────

/** Start a demo session. Called only from the pre-onboarding gate. */
export function start() {
  state = { active: true, ledger: emptyLedger() };
  try {
    window.localStorage.setItem(MODE_KEY, "1");
  } catch {
    // not persisted — the demo lasts this session
  }
  persist();
  emit();
}

export interface PastRun {
  rounds: number;
  /** Best single round, raw and signed. */
  bestRound: bigint;
  /** Closing paper balance, against `OPENING_BALANCE`. */
  balance: bigint;
}

/**
 * Leave the demo. Onboarding calls this, because a funded wallet and a paper
 * ledger must never be live at the same time — that is how a demo turns into a
 * general-purpose simulator.
 *
 * The *ledger* goes; a short **summary** of the run is kept. Someone who just
 * played ten rounds and then funded a wallet should not arrive at an app that
 * has forgotten all of it — that is the moment the conversion was earned. It is
 * a record of what they did in demo and is never mixed into real stats.
 */
export function end() {
  const { rounds, bestRound, balance } = state.ledger;
  state = { active: false, ledger: emptyLedger() };
  try {
    if (rounds > 0) {
      window.localStorage.setItem(
        PAST_KEY,
        JSON.stringify({
          rounds,
          bestRound: bestRound.toString(),
          balance: balance.toString(),
        }),
      );
    }
    window.localStorage.removeItem(MODE_KEY);
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    // nothing to clear
  }
  emit();
}

/** The last demo run, if there was one. Display only. */
export function pastRun(): PastRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PAST_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return {
      rounds: Number(saved.rounds ?? 0),
      bestRound: BigInt(saved.bestRound ?? 0),
      balance: BigInt(saved.balance ?? OPENING_BALANCE),
    };
  } catch {
    return null;
  }
}

export function clearPastRun() {
  try {
    window.localStorage.removeItem(PAST_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * True while something is still riding — an open position or a bid on the book.
 *
 * Leaving demo throws the ledger away, so the way out has to refuse while a
 * round is unfinished rather than quietly discard it.
 */
export function hasOpenPlay(): boolean {
  return (
    Object.values(state.ledger.positions).some((v) => v > 0n) ||
    Object.keys(state.ledger.resting).length > 0
  );
}

// ── The ledger ──────────────────────────────────────────────────────────────

function update(fn: (l: Ledger) => void) {
  const ledger = {
    ...state.ledger,
    positions: { ...state.ledger.positions },
    resting: { ...state.ledger.resting },
  };
  fn(ledger);
  state = { ...state, ledger };
  persist();
  emit();
}

export const getBalance = () => state.ledger.balance;

const key = (marketId: string, idx: 0 | 1) => `${marketId}:${idx}`;

export const held = (marketId: string, side: "up" | "down") =>
  state.ledger.positions[key(marketId, side === "up" ? 0 : 1)] ?? 0n;

/** Pay for contracts and take delivery of them. */
export function fill(marketId: string, side: "up" | "down", cost: bigint, size: bigint) {
  update((l) => {
    l.balance -= cost;
    const k = key(marketId, side === "up" ? 0 : 1);
    l.positions[k] = (l.positions[k] ?? 0n) + size;
  });
}

/**
 * Give up contracts and take the proceeds.
 *
 * Clamped to what is held, and the proceeds are scaled by the same ratio. A
 * paper balance credited for contracts that were never owned is an invented
 * number, so the floor lives here rather than in whichever caller sized the
 * fill.
 */
export function close(marketId: string, side: "up" | "down", proceeds: bigint, size: bigint) {
  update((l) => {
    if (size <= 0n) return;
    const k = key(marketId, side === "up" ? 0 : 1);
    const have = l.positions[k] ?? 0n;
    const sold = size > have ? have : size;
    if (sold <= 0n) return;
    l.balance += (proceeds * sold) / size;
    l.positions[k] = have - sold;
    if (l.positions[k] <= 0n) delete l.positions[k];
  });
}

/** Credit a settled round and clear the position it came from. */
export function settle(marketId: string, side: "up" | "down", payout: bigint, net: bigint) {
  update((l) => {
    l.balance += payout;
    delete l.positions[key(marketId, side === "up" ? 0 : 1)];
    l.rounds += 1;
    if (net > l.bestRound) l.bestRound = net;
  });
}

export const restingIn = (marketId: string) => state.ledger.resting[marketId] ?? null;

export function rest(
  marketId: string,
  side: "up" | "down",
  yesPrice: number,
  size: bigint,
  escrow: bigint,
) {
  update((l) => {
    l.balance -= escrow;
    l.resting[marketId] = { side, yesPrice, size };
  });
}

/** Take a paper bid off the book, returning its escrow. */
export function unrest(marketId: string, refund: bigint) {
  update((l) => {
    l.balance += refund;
    delete l.resting[marketId];
  });
}

/**
 * A resting bid whose window closed without anyone coming to it.
 *
 * On chain the order ages off and the escrow returns by itself, which is why
 * the real path needs no equivalent. In paper it has to be done explicitly —
 * and forgetting it meant an unfilled bid silently ate the balance, which is
 * the wrong kind of unflattering.
 */
export function expireRest(marketId: string) {
  const pending = state.ledger.resting[marketId];
  if (!pending) return;
  const escrow = BigInt(
    Math.round(
      (Number(pending.size) / 1e6) *
        (pending.side === "up" ? pending.yesPrice : 1 - pending.yesPrice) *
        1e6,
    ),
  );
  unrest(marketId, escrow);
}
