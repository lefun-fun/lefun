import { Game } from "./gameDef";

type GameV2_3_0 = Omit<Game, "gameSettings" | "gamePlayerSettings"> & {
  gameSettings?: Record<string, any>;
  gamePlayerSettings?: Record<string, any>;
};

function V2_3_0_to_V2_4_0(game: any): Game {
  // Migrate the game settings to an array.
  let { gameSettings, gamePlayerSettings } = game;

  if (gameSettings && Array.isArray(gameSettings)) {
    gameSettings = Object.entries(gameSettings).map(([key, value]) => ({
      ...value,
      key,
    }));
  }

  if (gamePlayerSettings && Array.isArray(gamePlayerSettings)) {
    gamePlayerSettings = Object.entries(gamePlayerSettings).map(
      ([key, value]) => ({
        ...value,
        key,
      }),
    );
  }

  return { ...game, gameSettings, gamePlayerSettings };
}
