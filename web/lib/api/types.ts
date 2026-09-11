export type GameId = "lucky" | "snipe" | "press" | "duel";

export type MinigameId = "line-rider" | "flappy-piper";

export const GAME_LABELS: Record<GameId, string> = {
  lucky: "Lucky",
  snipe: "Snipe",
  press: "Press",
  duel: "Duel",
};

/** Games that ship to everyone. The rest are admin-gated lab experiments. */
export const LIVE_GAMES: GameId[] = ["lucky", "snipe", "press", "duel"];
/** Empty: every game now trades real Event Contract windows. */
export const LAB_GAMES: GameId[] = [];
export const MINIGAMES: MinigameId[] = ["line-rider", "flappy-piper"];

export interface Settings {
  confirmTrades: boolean;
  sounds: boolean;
  haptics: boolean;
  music: boolean;
  reduceMotion: boolean;
}
