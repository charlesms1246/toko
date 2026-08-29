/**
 * The demo backend.
 *
 * Everything the app would normally fetch from the live API is served
 * from here instead: an in-memory account, a play lifecycle driven by the
 * simulator in `math.ts`, and fixture data for the menu screens.
 *
 * The lifecycle follows the real timings — a play confirms 850ms after it is
 * opened, its settle price is latched 5s before expiry, and the result is held
 * back for a 900ms suspense window after that.
 */

import {
  CONFIRM_MS,
  DEFAULT_DURATION,
  SETTLE_LOCK_MS,
  SUSPENSE_MS,
  STAKE_CONFIG,
  buildLadder,
  luckyZ,
  markToMarket,
  money,
  moonshotZ,
  roundVol,
  strikeFor,
  type MarkInput,
} from "./math";
import { SEED_PRICES, spot } from "./prices";
import {
  ACHIEVEMENTS,
  DEMO_ADDRESS,
  LEADERBOARD_HANDLES,
  SEED_HISTORY,
  achievementImage,
} from "./fixtures";
import type {
  Achievement,
  GameId,
  LeaderboardRow,
  Market,
  MinigameId,
  MinigameScoreRow,
  Play,
  PlayStatus,
  Settings,
  Side,
  Stats,
  User,
} from "./types";
import { MOONSHOT_LADDER } from "./math";
import { TRADABLE_ASSETS } from "./prices";

// ── Account state ────────────────────────────────────────────────────────────

interface Counters {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  maxStreak: number;
  totalVolume: number;
  netPnl: number;
  cashouts: number;
  maxMultiplierCashed: number;
  distinctGames: string[];
  comebackDone: boolean;
  lastWasLoss: boolean;
  firstPlayAt: string;
  favoriteGame: string;
  settledWins: number;
  tinyStake: boolean;
  fastCashout: boolean;
  closeCall: boolean;
  doublePlay: boolean;
  nightPlay: boolean;
  earlyPlay: boolean;
  playsByDay: Record<number, number>;
  lastOpenedMs: number;
}

const dayIndex = (ms: number) =>
  Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / 86_400_000);

function seedCounters(): Counters {
  const now = Date.now();
  const today = dayIndex(now);
  return {
    gamesPlayed: 47,
    wins: 29,
    losses: 18,
    currentStreak: 3,
    maxStreak: 6,
    totalVolume: 2840,
    netPnl: 612,
    cashouts: 8,
    maxMultiplierCashed: 12,
    distinctGames: ["lucky", "range", "moonshot"],
    comebackDone: true,
    lastWasLoss: false,
    firstPlayAt: new Date(now - 34 * 86_400_000).toISOString(),
    favoriteGame: "lucky",
    settledWins: 18,
    tinyStake: false,
    fastCashout: true,
    closeCall: false,
    doublePlay: true,
    nightPlay: false,
    earlyPlay: false,
    playsByDay: { [today - 2]: 6, [today - 1]: 4, [today]: 3 },
    lastOpenedMs: 0,
  };
}

interface State {
  balance: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  settings: Settings;
  counters: Counters;
  unlocked: Record<string, string>;
  minigameScores: Record<MinigameId, number>;
  referralCode: string;
  referralClaimed: number;
  admin: boolean;
  lastFaucetMs: number;
}

const DEFAULT_SETTINGS: Settings = {
  confirmTrades: true,
  sounds: true,
  haptics: true,
  music: true,
  reduceMotion: false,
};

const STORAGE_KEY = "toko_demo_state";

function initialState(): State {
  return {
    balance: 250,
    username: "toko_demo",
    displayName: "TOKO Demo",
    avatarUrl: null,
    settings: { ...DEFAULT_SETTINGS },
    counters: seedCounters(),
    unlocked: {},
    minigameScores: { "line-rider": 1240, "flappy-piper": 14 },
    referralCode: "TOKO-DEMO",
    referralClaimed: 0,
    admin: false,
    lastFaucetMs: 0,
  };
}

let state: State = initialState();

// Unlock whatever the seeded counters already earn.
for (const def of ACHIEVEMENTS) {
  if (metricValue(def.metric) >= def.threshold) {
    state.unlocked[def.slug] = new Date(
      Date.now() - 24 * 60 * 60_000,
    ).toISOString();
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        balance: state.balance,
        username: state.username,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        settings: state.settings,
        counters: state.counters,
        unlocked: state.unlocked,
        minigameScores: state.minigameScores,
        referralClaimed: state.referralClaimed,
        admin: state.admin,
      }),
    );
  } catch {
    // storage unavailable — the demo just won't persist
  }
}

/** True once the persisted state has been read on the client. */
let hydrated = false;

export const isHydrated = () => hydrated;

export function hydrate() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<State>;
    state = {
      ...state,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      counters: { ...state.counters, ...(saved.counters ?? {}) },
    };
  } catch {
    // corrupt blob — keep the fresh state
  }
  emit();
}

// ── Subscription ─────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  ensureTicker();
  return () => {
    listeners.delete(fn);
  };
}

export function getVersion() {
  return version;
}

// ── Plays ────────────────────────────────────────────────────────────────────

interface PlayContext extends MarkInput {
  asset: string;
  settlePrice?: number;
  confirmAtMs: number;
  resolveAtMs: number;
}

const plays = new Map<string, Play>();
const contexts = new Map<string, PlayContext>();
const openIds = new Set<string>();
const history: Play[] = [];

let seq = 0;
const newId = () =>
  `demo_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;

const digest = () =>
  `0x${Array.from({ length: 64 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)],
  ).join("")}`;

/** Seed the history list so the menu screens have something to show. */
function seedHistory() {
  const now = Date.now();
  for (const seed of SEED_HISTORY) {
    const openedAt = now - seed.minsAgo * 60_000;
    const entry = SEED_PRICES[seed.asset] ?? 1;
    plays.set(`seed_${seed.minsAgo}`, {
      id: `seed_${seed.minsAgo}`,
      game: seed.game,
      status: seed.status,
      stake: money(seed.stake),
      params: { asset: seed.asset, duration: DEFAULT_DURATION },
      market: {
        asset: seed.asset,
        oracleId: `demo-oracle-${seed.asset}`,
        expiry: openedAt + DEFAULT_DURATION * 1000,
      },
      entryValue: money(seed.stake),
      markValue: money(seed.stake + seed.pnl),
      pnl: money(seed.pnl),
      multiplier: seed.mult,
      maxPayout: money(seed.stake * seed.mult),
      entrySpot: String(entry),
      openedAt: new Date(openedAt).toISOString(),
      settledAt: new Date(openedAt + DEFAULT_DURATION * 1000).toISOString(),
      payout: money(Math.max(0, seed.stake + seed.pnl)),
      settlePrice: String(entry),
      txSettle: digest(),
    });
    history.push(plays.get(`seed_${seed.minsAgo}`)!);
  }
}
seedHistory();

export class InsufficientBalance extends Error {
  constructor() {
    super("INSUFFICIENT_BALANCE");
  }
}

function requireStake(stake: number) {
  if (!Number.isFinite(stake) || stake <= 0) throw new Error("BAD_STAKE");
  if (stake > state.balance) throw new InsufficientBalance();
}

function register(play: Play, context: PlayContext) {
  plays.set(play.id, play);
  contexts.set(play.id, context);
  openIds.add(play.id);
  history.unshift(play);

  state.balance -= context.stake;
  const counters = state.counters;
  counters.gamesPlayed += 1;
  counters.totalVolume += context.stake;
  if (!counters.distinctGames.includes(play.game)) {
    counters.distinctGames.push(play.game);
  }
  if (context.stake <= 2) counters.tinyStake = true;

  const now = Date.now();
  const hour = new Date(now).getHours();
  if (hour >= 22) counters.nightPlay = true;
  if (hour < 9) counters.earlyPlay = true;
  if (counters.lastOpenedMs && now - counters.lastOpenedMs <= 10 * 60_000) {
    counters.doublePlay = true;
  }
  counters.lastOpenedMs = now;
  const day = dayIndex(now);
  counters.playsByDay[day] = (counters.playsByDay[day] ?? 0) + 1;

  persist();
  emit();
  ensureTicker();
}

// ── Opening plays ────────────────────────────────────────────────────────────

export function openLucky(input: {
  asset: string;
  stake: number;
  side: Side;
  multiplier: number;
  duration?: number;
}): Play {
  requireStake(input.stake);
  const duration = input.duration ?? DEFAULT_DURATION;
  const entry = spot(input.asset);
  const vol = roundVol(duration);
  const target = strikeFor(entry, input.side, luckyZ(input.multiplier), duration);
  const openedMs = Date.now();
  const expiryMs = openedMs + duration * 1000;

  const play: Play = {
    id: newId(),
    game: "lucky",
    status: "pending",
    stake: money(input.stake),
    params: {
      asset: input.asset,
      side: input.side,
      multiplier: input.multiplier,
      duration,
    },
    market: {
      asset: input.asset,
      oracleId: `demo-oracle-${input.asset}`,
      expiry: expiryMs,
      strike: String(target),
    },
    entryValue: money(input.stake),
    markValue: money(input.stake),
    pnl: "0.00",
    multiplier: input.multiplier,
    maxPayout: money(input.stake * input.multiplier),
    entrySpot: String(entry),
    openedAt: new Date(openedMs).toISOString(),
    txMint: digest(),
  };

  register(play, {
    game: "lucky",
    asset: input.asset,
    stake: input.stake,
    entry,
    side: input.side,
    lockedMult: input.multiplier,
    target,
    roundVol: vol,
    openedMs,
    expiryMs,
    confirmAtMs: openedMs + CONFIRM_MS,
    resolveAtMs: expiryMs + SUSPENSE_MS,
  });
  return play;
}

export function openMoonshot(input: {
  asset: string;
  stake: number;
  side: Side;
  reach: number;
}): Play {
  requireStake(input.stake);
  const reach = Math.max(2, Math.min(25, input.reach));
  const duration = DEFAULT_DURATION;
  const entry = spot(input.asset);
  const vol = roundVol(duration);
  const target = strikeFor(entry, input.side, moonshotZ(reach), duration);
  const openedMs = Date.now();
  const expiryMs = openedMs + duration * 1000;

  const play: Play = {
    id: newId(),
    game: "moonshot",
    status: "pending",
    stake: money(input.stake),
    params: {
      asset: input.asset,
      side: input.side,
      multiplier: reach,
      duration,
      reach,
    },
    market: {
      asset: input.asset,
      oracleId: `demo-oracle-${input.asset}`,
      expiry: expiryMs,
      strike: String(target),
    },
    entryValue: money(input.stake),
    markValue: money(input.stake),
    pnl: "0.00",
    multiplier: reach,
    maxPayout: money(input.stake * reach),
    entrySpot: String(entry),
    openedAt: new Date(openedMs).toISOString(),
    txMint: digest(),
  };

  register(play, {
    game: "moonshot",
    asset: input.asset,
    stake: input.stake,
    entry,
    side: input.side,
    lockedMult: reach,
    target,
    roundVol: vol,
    openedMs,
    expiryMs,
    confirmAtMs: openedMs + CONFIRM_MS,
    resolveAtMs: expiryMs + SUSPENSE_MS,
  });
  return play;
}

/** Lab games reuse the directional plumbing with their own multiplier. */
export function openLabPlay(input: {
  game: GameId;
  asset: string;
  stake: number;
  side: Side;
  multiplier: number;
  duration?: number;
}): Play {
  requireStake(input.stake);
  const duration = input.duration ?? DEFAULT_DURATION;
  const entry = spot(input.asset);
  const vol = roundVol(duration);
  const z = Math.max(0, Math.log(input.multiplier) / 2);
  const target = strikeFor(entry, input.side, z, duration);
  const openedMs = Date.now();
  const expiryMs = openedMs + duration * 1000;

  const play: Play = {
    id: newId(),
    game: input.game,
    status: "pending",
    stake: money(input.stake),
    params: {
      asset: input.asset,
      side: input.side,
      multiplier: input.multiplier,
      duration,
    },
    market: {
      asset: input.asset,
      oracleId: `demo-oracle-${input.asset}`,
      expiry: expiryMs,
      strike: String(target),
    },
    entryValue: money(input.stake),
    markValue: money(input.stake),
    pnl: "0.00",
    multiplier: input.multiplier,
    maxPayout: money(input.stake * input.multiplier),
    entrySpot: String(entry),
    openedAt: new Date(openedMs).toISOString(),
    txMint: digest(),
  };

  register(play, {
    game: "lucky", // same mark-to-market path
    asset: input.asset,
    stake: input.stake,
    entry,
    side: input.side,
    lockedMult: input.multiplier,
    target,
    roundVol: vol,
    openedMs,
    expiryMs,
    confirmAtMs: openedMs + CONFIRM_MS,
    resolveAtMs: expiryMs + SUSPENSE_MS,
  });
  return play;
}

// ── Settlement ───────────────────────────────────────────────────────────────

export type SettleReason = "settle" | "cashout";

function settle(id: string, reason: SettleReason) {
  const play = plays.get(id);
  const context = contexts.get(id);
  if (!play || !context || !openIds.has(id)) return;

  openIds.delete(id);
  contexts.delete(id);

  const price =
    reason === "settle" && context.settlePrice != null
      ? context.settlePrice
      : spot(context.asset);
  const mark = markToMarket(context, price);

  let status: PlayStatus;
  let payout: number;
  if (reason === "cashout") {
    status = "cashed_out";
    payout = Math.max(0, mark.markValue);
  } else if (mark.win) {
    status = "won";
    payout = context.stake * context.lockedMult;
  } else {
    status = "lost";
    payout = 0;
  }

  const pnl = payout - context.stake;
  play.status = status;
  play.markValue = money(payout);
  play.pnl = money(pnl);
  play.payout = money(payout);
  play.multiplier = mark.multiplier;
  play.settledAt = new Date().toISOString();
  play.settlePrice = String(price);
  if (reason === "settle") play.txSettle = digest();
  else play.txRedeem = digest();

  const counters = state.counters;
  state.balance += payout;
  counters.netPnl += pnl;

  const isWin = status === "won" || (status === "cashed_out" && pnl >= 0);
  if (isWin) {
    counters.wins += 1;
    counters.currentStreak += 1;
    counters.maxStreak = Math.max(counters.maxStreak, counters.currentStreak);
    if (status === "cashed_out") counters.cashouts += 1;
    else counters.settledWins += 1;
    counters.maxMultiplierCashed = Math.max(
      counters.maxMultiplierCashed,
      mark.multiplier,
    );
    if (counters.lastWasLoss) counters.comebackDone = true;
    counters.lastWasLoss = false;
  } else {
    counters.losses += 1;
    counters.currentStreak = 0;
    counters.lastWasLoss = true;
  }

  if (
    status === "cashed_out" &&
    Date.now() - context.openedMs <= 30_000
  ) {
    counters.fastCashout = true;
  }
  if (Math.abs(price - (context.target ?? context.entry)) / context.entry < 0.0004) {
    counters.closeCall = true;
  }


  const unlocked = checkAchievements();
  persist();
  emit();
  settleListeners.forEach((fn) => fn(play, unlocked));
}

export function cashOut(id: string) {
  settle(id, "cashout");
}

type SettleListener = (play: Play, unlocked: string[]) => void;
const settleListeners = new Set<SettleListener>();

export function onSettle(fn: SettleListener) {
  settleListeners.add(fn);
  return () => {
    settleListeners.delete(fn);
  };
}

// ── Ticker ───────────────────────────────────────────────────────────────────

let ticker: ReturnType<typeof setInterval> | null = null;

function ensureTicker() {
  if (ticker || typeof window === "undefined") return;
  ticker = setInterval(tick, 250);
}

function tick() {
  if (!openIds.size) return;
  const now = Date.now();
  let changed = false;

  for (const id of [...openIds]) {
    const play = plays.get(id)!;
    const context = contexts.get(id)!;

    if (play.status === "pending") {
      if (now < context.confirmAtMs) continue;
      play.status = "open";
      changed = true;
    }

    // Latch the settle price before expiry so the result can't be sniped.
    if (
      context.settlePrice == null &&
      now >= context.expiryMs - SETTLE_LOCK_MS
    ) {
      context.settlePrice = spot(context.asset);
    }

    const price = context.settlePrice ?? spot(context.asset);
    const mark = markToMarket(context, price, now);
    play.markValue = money(mark.markValue);
    play.pnl = money(mark.pnl);
    changed = true;

    if (now >= context.resolveAtMs) settle(id, "settle");
  }

  if (changed) emit();
}

// ── Achievements ─────────────────────────────────────────────────────────────

function longestDayStreak(days: Record<number, number>): number {
  const keys = Object.keys(days).map(Number).sort((a, b) => a - b);
  if (!keys.length) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    run = keys[i] === keys[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function metricValue(metric: string): number {
  const c = state?.counters ?? seedCounters();
  switch (metric) {
    case "games_played": return c.gamesPlayed;
    case "wins": return c.wins;
    case "win_streak": return c.maxStreak;
    case "volume": return Math.floor(c.totalVolume);
    case "distinct_games": return c.distinctGames.length;
    case "settled_wins": return c.settledWins;
    case "tiny_stake": return c.tinyStake ? 1 : 0;
    case "fast_cashout": return c.fastCashout ? 1 : 0;
    case "close_call": return c.closeCall ? 1 : 0;
    case "double_play": return c.doublePlay ? 1 : 0;
    case "night_plays": return c.nightPlay ? 1 : 0;
    case "early_plays": return c.earlyPlay ? 1 : 0;
    case "plays_in_day":
      return Object.values(c.playsByDay).reduce((a, b) => Math.max(a, b), 0);
    case "day_streak": return longestDayStreak(c.playsByDay);
    case "comeback": return c.comebackDone ? 1 : 0;
    default: return 0;
  }
}

function checkAchievements(): string[] {
  const freshly: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (state.unlocked[def.slug]) continue;
    if (metricValue(def.metric) >= def.threshold) {
      state.unlocked[def.slug] = new Date().toISOString();
      freshly.push(def.slug);
    }
  }
  return freshly;
}

// ── Read API ─────────────────────────────────────────────────────────────────

export function getUser(): User {
  return {
    id: "demo",
    address: DEMO_ADDRESS,
    displayName: state.displayName,
    username: state.username,
    email: "demo@toko.app",
    provider: "dev",
    avatarUrl: state.avatarUrl,
    customAvatar: state.avatarUrl != null,
    balance: money(state.balance),
    managerReady: true,
    settings: state.settings,
    specialRoles: state.admin ? ["ADMIN"] : [],
  };
}

export const getBalance = () => state.balance;
export const isAdmin = () => state.admin;

export function setAdmin(next: boolean) {
  state.admin = next;
  persist();
  emit();
}

export function getSettings(): Settings {
  return state.settings;
}

export function updateSettings(patch: Partial<Settings>) {
  state.settings = { ...state.settings, ...patch };
  persist();
  emit();
}

export function setUsername(name: string) {
  state.username = name;
  state.displayName = name;
  persist();
  emit();
}

export function setAvatar(url: string | null) {
  state.avatarUrl = url;
  persist();
  emit();
}

export function getStats(): Stats {
  const c = state.counters;
  return {
    gamesPlayed: c.gamesPlayed,
    wins: c.wins,
    losses: c.losses,
    winRate: c.gamesPlayed > 0 ? c.wins / c.gamesPlayed : 0,
    currentStreak: c.currentStreak,
    maxStreak: c.maxStreak,
    bestMultiplier: c.maxMultiplierCashed,
    totalVolume: money(c.totalVolume),
    netPnl: money(c.netPnl),
    firstPlayAt: c.firstPlayAt,
    favoriteGame: c.favoriteGame,
  };
}

export function getAchievements(): Achievement[] {
  return ACHIEVEMENTS.map((def) => {
    const unlockedAt = state.unlocked[def.slug];
    return {
      ...def,
      unlocked: !!unlockedAt,
      unlockedAt,
      progress: Math.min(1, metricValue(def.metric) / def.threshold),
      image: achievementImage(def.slug),
    };
  });
}

export function getMarkets(): Market[] {
  return TRADABLE_ASSETS.map((asset) => ({
    asset,
    spot: spot(asset),
    durations: [10, 30, 60],
    playsPaused: false,
  }));
}

export function getPlay(id: string): Play | undefined {
  return plays.get(id);
}

export function listPlays(options: { status?: PlayStatus; limit?: number } = {}) {
  const { status, limit = 30 } = options;
  const filtered = status
    ? history.filter((p) =>
        status === "open"
          ? p.status === "open" || p.status === "pending"
          : p.status === status,
      )
    : history;
  return filtered.slice(0, limit);
}

export const getOpenPlays = () => listPlays({ status: "open", limit: 30 });

export function getStakeLadder(): number[] {
  const max = state.admin ? STAKE_CONFIG.maxStakeAdmin : STAKE_CONFIG.maxStake;
  return buildLadder(STAKE_CONFIG.minStake, max);
}

/** Seven tiered Range quotes for the current round. */
/** How far each Moonshot target sits from spot. */
export function moonshotAim(asset: string) {
  const price = spot(asset);
  return MOONSHOT_LADDER.map((reach) => {
    const target = strikeFor(price, "up", moonshotZ(reach), DEFAULT_DURATION);
    return { reach, offsetFrac: (target - price) / price };
  });
}

// ── Wallet ───────────────────────────────────────────────────────────────────

export const FAUCET_AMOUNT = 500;
export const FAUCET_COOLDOWN_MS = 60_000;
export const GRANT_AMOUNT = 100;
export const GRANT_THRESHOLD = 1.5;

export function requestFaucet(): { ok: boolean; error?: string } {
  const now = Date.now();
  if (now - state.lastFaucetMs < FAUCET_COOLDOWN_MS) {
    return { ok: false, error: "FAUCET_COOLDOWN" };
  }
  state.lastFaucetMs = now;
  state.balance += FAUCET_AMOUNT;
  persist();
  emit();
  return { ok: true };
}

/** Top the player up when they are broke, otherwise open the deposit sheet. */
export function requestGrant(): { granted: boolean } {
  if (state.balance >= GRANT_THRESHOLD) return { granted: false };
  state.balance += GRANT_AMOUNT;
  persist();
  emit();
  return { granted: true };
}

export function deposit(amount: number) {
  state.balance += amount;
  persist();
  emit();
}

export function withdraw(amount: number): { ok: boolean; error?: string } {
  if (amount > state.balance) return { ok: false, error: "INSUFFICIENT_BALANCE" };
  state.balance -= amount;
  persist();
  emit();
  return { ok: true };
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

/** Deterministic per-handle figures, so the board doesn't shuffle on render. */
function seededBoard(salt: number): LeaderboardRow[] {
  const rows = LEADERBOARD_HANDLES.map((handle, i) => {
    const noise = ((i * 2654435761 + salt * 40503) % 100000) / 100000;
    const pnl = 4200 * Math.pow(0.82, i) * (0.7 + noise * 0.6);
    const volume = pnl * (6 + noise * 8);
    return {
      handle,
      address: `0x${((i + 1) * 0x9e3779b1).toString(16).padStart(8, "0")}`,
      pnl,
      volume,
      plays: Math.round(18 + noise * 240),
    };
  });
  rows.sort((a, b) => b.pnl - a.pnl);
  return rows.map((row, i) => ({
    rank: i + 1,
    handle: row.handle,
    address: row.address,
    pnl: money(row.pnl),
    volume: money(row.volume),
    plays: row.plays,
  }));
}

export function getLeaderboard(game?: GameId): LeaderboardRow[] {
  const salt = game ? game.length * 7 : 0;
  const board = seededBoard(salt);
  const you: LeaderboardRow = {
    rank: 0,
    handle: state.username,
    address: DEMO_ADDRESS,
    pnl: money(state.counters.netPnl),
    volume: money(state.counters.totalVolume),
    plays: state.counters.gamesPlayed,
    isYou: true,
  };
  const merged = [...board, you].sort(
    (a, b) => Number(b.pnl) - Number(a.pnl),
  );
  return merged.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function getMinigameBoard(game: MinigameId): MinigameScoreRow[] {
  const rows = LEADERBOARD_HANDLES.slice(0, 12).map((handle, i) => ({
    handle,
    score: Math.round(
      (game === "line-rider" ? 2400 : 42) * Math.pow(0.86, i) + i * 3,
    ),
  }));
  rows.push({ handle: state.username, score: state.minigameScores[game] });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((row, i) => ({
    rank: i + 1,
    handle: row.handle,
    score: row.score,
    isYou: row.handle === state.username,
  }));
}

export function submitMinigameScore(game: MinigameId, score: number) {
  if (score > state.minigameScores[game]) {
    state.minigameScores[game] = score;
    persist();
    emit();
  }
}

export const getMinigameBest = (game: MinigameId) => state.minigameScores[game];

// ── Referrals ────────────────────────────────────────────────────────────────

export function getReferral() {
  return {
    code: state.referralCode,
    handle: state.username,
    url: `https://toko.app/@${state.username}`,
    invited: 7,
    earned: money(24.5),
    claimable: money(Math.max(0, 24.5 - state.referralClaimed)),
  };
}

export function claimReferral() {
  const referral = getReferral();
  const amount = Number(referral.claimable);
  if (amount <= 0) return { ok: false };
  state.referralClaimed += amount;
  state.balance += amount;
  persist();
  emit();
  return { ok: true, amount: money(amount) };
}
