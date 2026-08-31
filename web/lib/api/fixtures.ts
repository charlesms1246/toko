import type { GameId } from "./types";

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

/**
 * One line each, describing what the game actually does now.
 *
 * Four of these still described the pre-integration mechanics — Pin paying for
 * the closest call, Press tightening a *band* (that was Range, which no longer
 * exists) — which is a promise the game does not keep.
 */
export const GAME_TAGLINES: Record<GameId, string> = {
  lucky: "Pick a side. Pick a payout.",
  moonshot: "Aim far. Get paid far.",
  pin: "Name your price. Wait for the market to come to you.",
  snipe: "The offer slides toward zero. Take it before it is pulled.",
  press: "Roll a win into the next window, or fold.",
  rush: "Take the deal, or hold it to the buzzer.",
  breakout: "Call the move continuing, window after window.",
  duel: "Post your odds. Someone takes the other side.",
};

/**
 * Only links that go somewhere real.
 *
 * There were four here, two of them invented — an X account and a Telegram that
 * have never existed. A dead link presented as ours is the same kind of untruth
 * as a fabricated balance, so they are gone rather than waiting to be filled in.
 * Add them back when the accounts do.
 */
export const LINKS = {
  github: "https://github.com/charlesms1246/toko",
  somnia: "https://docs.somnia.network",
  dreamdex: "https://dreamdex.io",
};

export const APP = {
  name: "TOKO",
  tagline: "Built for fun and money.",
  description:
    "The simplest, most fun way to trade. A gamified trading console on Somnia.",
};
