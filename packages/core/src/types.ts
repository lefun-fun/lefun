export type GameId = string;
export type GameVersion = string;
export type PartyId = string;
export type MatchId = string;
export type MatchDataId = string;
export type UserId = string;

export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];

export type Scores = Record<UserId, number>;
export type ScoreType = "seconds" | "rank" | "integer";

/*
 * We have some game definition types here, namely the ones used not only in the game
 * but also on the website.
 */

export type GameSettingOption = {
  value: string;
  // Is it the default option. If it's missing we'll take the first one.
  default?: boolean;

  // Keeping as optional for backward compatibility.
  label?: string;
  shortLabel?: string;
};

export type GameSetting = {
  key: string;
  options: GameSettingOption[];
  // Don't hide the game setting even when the default value is selected.
  alwaysShow?: boolean;

  // Keeping as optional for backward compatiblity
  label?: string;
  help?: string;

  // If this function is not implemented we'll use, in order:
  // * `previousMatchValue`
  // * The first option `default: true`
  // * The first option
  //
  // If your implement this function, don't forget to return `previousMatchValue` when
  // it is defined, if you want to keep that behaviour!
  defaultFunc?: ({
    locale,
    previousMatchValue,
  }: {
    locale: Locale;
    previousMatchValue?: string;
  }) => string;
};

export type GameSettings = GameSetting[];

/*
 * Fields common to all the player setting options.
 */
export type CommonPlayerSettingOption = {
  value: string;
  // Is it the default option? If none is the default, we will fallback on the first
  // player option as the default.
  default?: boolean;
};

type ColorPlayerSettingOption = {
  // This is the color for the lobby. Only the `value` will be accessible in the
  // front-end code of the game.
  label: string;
} & CommonPlayerSettingOption;

type StringPlayerSettingOption = {
  // Backward compatibility only. This is not used for games that are translated.
  label?: string;
} & CommonPlayerSettingOption;

// Note that some fields are common to all types of game player setting, and some
// depend on the type.
export type GamePlayerSetting = {
  // Can different players have the same selected option?
  // By default we assume *not* exclusive.
  exclusive?: boolean;
  // Does it apply to humans, bots, or both?
  // By default we assume to both.
  appliesToHumans?: boolean;
  // appliesToBot?: boolean;

  // Keeping for backward compability.
  label?: string;
  help?: string;
} & (
  | {
      type: "color";
      options: ColorPlayerSettingOption[];
    }
  | { type: "string"; options: StringPlayerSettingOption[] }
);

// FIXME This should be a list, to get an order, like the game options. This will be a problem when we have
// more than one option (which is not the case yet!).
// But at the same time being able to query the option using a string is useful, and
// it's missing in the Game Options. Ideally find a way to have the best of both worlds,
// for both the (regular) options and the player options... without making it to
// cumbersome for the game developer! We probably want to internally build a allIds/byId
// scheme from the list of options, and split the "game player options DEF" with the
// "gamePlayerSettings" that we store.
export type GamePlayerSettings = Record<string, GamePlayerSetting>;

export type GameStat = {
  key: string;
};
export type GameStats = GameStat[];

export type Credits = {
  design?: string[];
};
