export type GameId =
  | "lucky"
  | "range"
  | "moonshot"
  | "pin"
  | "snipe"
  | "press"
  | "rush"
  | "breakout";

export type MinigameId = "line-rider" | "flappy-piper";

export const GAME_LABELS: Record<GameId, string> = {
  lucky: "Lucky",
  range: "Range",
  moonshot: "Moonshot",
  pin: "Pin",
  snipe: "Snipe",
  press: "Press",
  rush: "Rush",
  breakout: "Breakout",
};

/** Games that ship to everyone. The rest are admin-gated lab experiments. */
export const LIVE_GAMES: GameId[] = ["lucky", "range", "moonshot"];
export const LAB_GAMES: GameId[] = ["pin", "snipe", "press", "rush", "breakout"];
export const MINIGAMES: MinigameId[] = ["line-rider", "flappy-piper"];

export type PlayStatus =
  | "pending"
  | "open"
  | "won"
  | "lost"
  | "cashed_out"
  | "error";

export type Side = "up" | "down";

export interface PlayParams {
  asset: string;
  side?: Side;
  multiplier?: number;
  duration?: number;
  lower?: string;
  upper?: string;
  widthPct?: number;
  reach?: number;
}

export interface PlayMarket {
  asset: string;
  oracleId: string;
  expiry: number;
  strike?: string;
  lower?: string;
  upper?: string;
}

export interface Play {
  id: string;
  game: GameId;
  status: PlayStatus;
  stake: string;
  params: PlayParams;
  market: PlayMarket;
  entryValue: string;
  markValue: string;
  pnl: string;
  multiplier: number;
  maxPayout: string;
  entrySpot: string;
  openedAt: string;
  settledAt?: string;
  settlePrice?: string;
  payout?: string;
  txMint?: string;
  txRedeem?: string;
  txSettle?: string;
}

export interface Market {
  asset: string;
  spot: number;
  durations: number[];
  playsPaused: boolean;
}

export interface Achievement {
  slug: string;
  name: string;
  description: string;
  illo: string;
  metric: string;
  threshold: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  image: string;
}

export interface Stats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  bestMultiplier: number;
  totalVolume: string;
  netPnl: string;
  firstPlayAt: string;
  favoriteGame: string;
}

export interface Settings {
  confirmTrades: boolean;
  sounds: boolean;
  haptics: boolean;
  music: boolean;
  reduceMotion: boolean;
}

export interface User {
  id: string;
  address: string;
  displayName: string;
  username: string;
  email: string;
  provider: string;
  avatarUrl: string | null;
  customAvatar: boolean;
  balance: string;
  managerReady: boolean;
  settings: Settings;
  specialRoles?: string[];
}

export interface LeaderboardRow {
  rank: number;
  handle: string;
  address: string;
  pnl: string;
  volume: string;
  plays: number;
  isYou?: boolean;
}

export interface MinigameScoreRow {
  rank: number;
  handle: string;
  score: number;
  isYou?: boolean;
}

export interface Transaction {
  id: string;
  kind: "deposit" | "withdraw" | "grant" | "faucet" | "play" | "payout";
  amount: string;
  status: "confirmed" | "pending" | "failed";
  at: string;
  digest?: string;
}

export interface RangeQuote {
  tier: number;
  probability: number;
  multiplier: number;
  lower: number;
  upper: number;
  halfWidthPct: number;
}

export interface MoonshotLevel {
  reach: number;
  offsetFrac: number;
}
