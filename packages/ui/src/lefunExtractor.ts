import { extractor as defaultExtractor } from "@lingui/cli/api";

import { gameMessageKeys } from "@lefun/core";
import { Game } from "@lefun/game";

export const lefunExtractor = (game: Game<any, any>) => ({
  first: true,
  match(filename: string) {
    const extensions = [".ts", ".tsx"];
    for (const ext of extensions) {
      if (filename.endsWith(ext)) {
        return true;
      }
    }
    return false;
  },
  async extract(
    filename: string,
    code: string,
    onMessageExtracted: any,
    ctx: any,
  ) {
    if (this.first) {
      this.first = false;
      const origin = ["lefun", 0];
      // const fields = {
      //   name: "The name of your game",
      //   tagline: "One line tag line for your game",
      //   aka: "Name of a game it is similar to, inspired from, etc.",
      //   play_aka: "Play <game_aka> online",
      //   description: "A paragraph describing your game",
      // };

      // The fields that don't need any arguments.
      const fields = ["name", "tagline", "aka", "seoAka", "description"];
      for (const field of fields) {
        onMessageExtracted({
          id: gameMessageKeys[field](),
          // TODO For some reason those descriptions don't appear in the .po files.
          // message: desc,
          origin,
        });
      }

      // Game settings
      if (game.gameSettings) {
        for (const gameSetting of game.gameSettings) {
          const fields = ["gameSettingLabel", "gameSettingHelp"];
          const { key } = gameSetting;
          for (const field of fields) {
            onMessageExtracted({
              id: gameMessageKeys[field](key),
              origin,
            });
          }

          const { options } = gameSetting;
          for (const { value } of options) {
            const fields = [
              "gameSettingOptionLabel",
              "gameSettingOptionShortLabel",
            ];
            for (const field of fields) {
              onMessageExtracted({
                id: gameMessageKeys[field](key, value),
                origin,
              });
            }
          }
        }
      }

      // Game player settings
      if (game.gamePlayerSettings) {
        for (const gamePlayerSetting of game.gamePlayerSettings) {
          const { key, options, type } = gamePlayerSetting;

          // Add translations only for "string" player options.
          if (type !== "string") {
            continue;
          }

          const fields = ["gamePlayerSettingLabel"];
          for (const field of fields) {
            onMessageExtracted({
              id: gameMessageKeys[field](key),
              origin,
            });
          }

          for (const { value } of options) {
            const fields = ["gamePlayerSettingOptionLabel"];
            for (const field of fields) {
              onMessageExtracted({
                id: gameMessageKeys[field](key, value),
                origin,
              });
            }
          }
        }
      }
    }

    // Simply reuse the default extractor.
    return defaultExtractor.extract(filename, code, onMessageExtracted, {
      ...ctx,
    });
  },
});
