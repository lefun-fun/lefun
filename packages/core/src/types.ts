export type GameId = string;
export type GameVersion = string;
export type PartyId = string;
export type MatchId = string;
export type MatchDataId = string;
export type UserId = string;

export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];

/*
 * We have some game definition types here, namely the ones used not only in the game
 * but also on the website.
 */

export type GameSettingOption = {
  value: string;
  // Is it the default option. If it's missing we'll take the first one.
  isDefault?: boolean;

  // Keeping as optional for backward compatibility.
  label?: string;
  shortLabel?: string;
};

export type GameSetting = {
  key: string;
  options: GameSettingOption[];
  // Don't hide the game setting even when the default value is selected.
  // Defaults to `false`.
  alwaysShow?: boolean;

  // Keeping as optional for backward compatiblity
  label?: string;
  help?: string;

  // If this function is not implemented we'll use, in order:
  // * `previousMatchValue`
  // * The first option `default: true`
  // * The first option
  // This logic si defined where we set `defaultValue`.
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

export type GameSetting_ = GameSetting & {
  // We set this from the `isDefault` option if there is one.
  // This avoids the need to loop through all the options to find it.
  defaultValue: string;
};

export type GameSettings = GameSetting[];

export type GameSettings_ = {
  allIds: string[];
  byId: Record<string, GameSetting_>;
};

/*
 * Fields common to all the player setting options.
 */
export type CommonPlayerSettingOption = {
  value: string;
  // Is it the default option? If none is the default, we will fallback on the first
  // player option as the default.
  isDefault?: boolean;
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
  key: string;
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

export type GamePlayerSettings = GamePlayerSetting[];

export type GamePlayerSettings_ = {
  allIds: string[];
  byId: Record<string, GamePlayerSetting & { defaultValue: string }>;
};

export type GameStatType =
  | "integer"
  | "rank"
  | "seconds"
  | "boolean"
  // integer or float
  | "number";

type StatKey = string;

export type GameStat<K extends StatKey = StatKey> = {
  key: K;
  type: GameStatType;

  // Defaults to `higherIsBetter`.
  ordering?: "higherIsBetter" | "lowerIsBetter";

  determinesRank?: boolean;
  // Should we use this stat to make a leaderboard? Defaults to `false`.
  // Note that currently we assume that this can only apply to *match* stats.
  leaderboard?: boolean;
};

export type GameStat_ = Omit<
  Required<GameStat>,
  "determinesRank" | "leaderboard"
>;

export type GameStats = GameStat[];

export type GameStats_ = {
  allIds: StatKey[];
  byId: Record<StatKey, GameStat_>;
  // We use an array because I feel that later we'll want multiple leaderboards for
  // different scores (e.g. 3bv in Eggsplosion) but currently we only use the first
  // one for a single leaderboard per game.
  leaderboard: StatKey[];
  determinesRank: StatKey[];
};

// Some conditional type utilities.
export type IfNull<T, Y, N> = [T] extends [null] ? Y : N;
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

export type IfAnyNull<T, ANY, NULL, OTHER> = IfAny<
  T,
  ANY,
  IfNull<T, NULL, OTHER>
>;

export type IsExactly<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

export type If_ObjectOrNull_Null<T, ObjOrNull, Null, ELSE> =
  IsExactly<T, object | null> extends true
    ? ObjOrNull
    : IsExactly<T, null> extends true
      ? Null
      : ELSE;
