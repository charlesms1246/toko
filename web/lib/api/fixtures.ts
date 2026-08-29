import type { GameId, PlayStatus } from "./types";

export interface AchievementDef {
  slug: string;
  name: string;
  description: string;
  illo: string;
  metric: string;
  threshold: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { slug: "first_try", name: "First Try", description: "Complete your first play.", illo: "bolt", metric: "games_played", threshold: 1 },
  { slug: "getting_warm", name: "Getting Warm", description: "Play 3 times.", illo: "flame", metric: "games_played", threshold: 3 },
  { slug: "high_five", name: "High Five", description: "Play 5 times.", illo: "up", metric: "games_played", threshold: 5 },
  { slug: "ten_club", name: "Ten Club", description: "Win 10 plays.", illo: "trophy", metric: "wins", threshold: 10 },
  { slug: "tiny_bet", name: "Tiny Play", description: "Make a play of $2 or less.", illo: "coin", metric: "tiny_stake", threshold: 1 },
  { slug: "back_again", name: "Back Again", description: "Play 2 days in a row.", illo: "medal", metric: "day_streak", threshold: 2 },
  { slug: "daily_play", name: "Daily Play", description: "Complete 5 plays in one day.", illo: "bolt", metric: "plays_in_day", threshold: 5 },
  { slug: "night_shift", name: "Night Shift", description: "Play after 10 PM.", illo: "gem", metric: "night_plays", threshold: 1 },
  { slug: "early_signal", name: "Early Signal", description: "Play before 9 AM.", illo: "up", metric: "early_plays", threshold: 1 },
  { slug: "first_win", name: "First Win", description: "Win your first play.", illo: "trophy", metric: "wins", threshold: 1 },
  { slug: "quick_tap", name: "Quick Tap", description: "Sell a position back before it settles.", illo: "coin", metric: "cashed_out", threshold: 1 },
  { slug: "calm_click", name: "Calm Click", description: "Hold 3 plays to the buzzer and win.", illo: "medal", metric: "settled_wins", threshold: 3 },
  { slug: "double_play", name: "Double Play", description: "Complete 2 plays within 10 minutes.", illo: "dice", metric: "double_play", threshold: 1 },
  { slug: "mini_streak", name: "Mini Streak", description: "Win 2 plays in a row.", illo: "flame", metric: "win_streak", threshold: 2 },
  { slug: "market_hopper", name: "Sampler", description: "Trade two different assets.", illo: "dice", metric: "distinct_assets", threshold: 2 },
  { slug: "dollar_rookie", name: "Dollar Rookie", description: "Play a total of $25.", illo: "gem", metric: "volume", threshold: 25 },
  { slug: "bigger_move", name: "Bigger Move", description: "Play a total of $100.", illo: "gem", metric: "volume", threshold: 100 },
  { slug: "comeback", name: "Comeback", description: "Win after your previous play was a loss.", illo: "medal", metric: "comeback", threshold: 1 },
  { slug: "toko_regular", name: "TOKO Regular", description: "Complete 10 total plays.", illo: "bolt", metric: "games_played", threshold: 10 },
];

export const achievementImage = (slug: string) =>
  `/assets/achievements/achievement-${slug.replace(/_/g, "-")}.webp`;

/** Seed history, newest first. */
export interface SeedPlay {
  game: GameId;
  asset: string;
  status: PlayStatus;
  stake: number;
  mult: number;
  pnl: number;
  minsAgo: number;
}

export const SEED_HISTORY: SeedPlay[] = [
  { game: "lucky", asset: "BTC", status: "won", stake: 25, mult: 3, pnl: 50, minsAgo: 4 },
  { game: "lucky", asset: "SOMI", status: "cashed_out", stake: 10, mult: 5, pnl: 22, minsAgo: 60 },
  { game: "lucky", asset: "SOL", status: "lost", stake: 50, mult: 3, pnl: -50, minsAgo: 1740 },
  { game: "lucky", asset: "ETH", status: "won", stake: 5, mult: 2, pnl: 5, minsAgo: 2040 },
  { game: "moonshot", asset: "ETH", status: "lost", stake: 25, mult: 25, pnl: -25, minsAgo: 4800 },
  { game: "lucky", asset: "BTC", status: "won", stake: 10, mult: 10, pnl: 90, minsAgo: 5940 },
  { game: "moonshot", asset: "BTC", status: "cashed_out", stake: 10, mult: 10, pnl: 34, minsAgo: 7440 },
  { game: "lucky", asset: "SOMI", status: "cashed_out", stake: 10, mult: 5, pnl: 18, minsAgo: 7980 },
  { game: "moonshot", asset: "SOL", status: "won", stake: 25, mult: 5, pnl: 100, minsAgo: 8760 },
  { game: "lucky", asset: "SOMI", status: "won", stake: 50, mult: 3, pnl: 100, minsAgo: 9000 },
  { game: "lucky", asset: "ETH", status: "won", stake: 100, mult: 2, pnl: 100, minsAgo: 9540 },
];

export const DEMO_ADDRESS =
  "0xa3f08c7e5b1d49260e8a3f7c6d20b9e41f5c8a037e94d2b60a3c5f81e9b27d4c";

export const LEADERBOARD_HANDLES = [
  "0xvitalik", "0xdegen", "moonboi", "tokomaster", "rangequeen",
  "shortking", "diamondhands", "quickdraw", "thetagang", "sizematters",
  "luckystrike", "candleman", "wickhunter", "gridbot", "apeindex",
  "nocoiner", "fatfinger", "rugpull", "hodlite", "scalpel",
];

export const GAME_TAGLINES: Record<GameId, string> = {
  lucky: "Pick a side. Pick a payout.",
  moonshot: "Aim far. Get paid far.",
  pin: "Name the price. Closest call wins.",
  snipe: "The wall drifts in. Press when it is close.",
  press: "Tighten your winning band, or fold.",
  rush: "Take the deal, or push for a better one.",
  breakout: "Call the break before it happens.",
};

// Placeholders — point these at the real TOKO accounts when they exist.
export const LINKS = {
  twitter: "https://x.com/tokoconsole",
  github: "https://github.com/tokoconsole",
  docs: "https://docs.somnia.network",
  support: "https://t.me/tokoconsole",
};

export const APP = {
  name: "TOKO",
  tagline: "Built for fun and money.",
  description:
    "The simplest, most fun way to trade. A gamified trading console on Somnia.",
};
