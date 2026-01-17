import { Locale, UserId } from "./types";

export interface Players {
  // List of all the player ids for the match.
  allIds: UserId[];
  byId: { [userId: string]: Player };
}

// Options for a match for a given player.
export type MatchPlayerSettings = Record<string, string>;

// Options for a match for all the players.
export type MatchPlayersSettings = Record<UserId, MatchPlayerSettings>;

export type MatchSettings = Record<string, string>;

/*
 * Player info that is common to all games. A Player is a User in a Match.
 */
export interface Player {
  // When in the lobby, are we ready to start. When everyone is ready the game starts.
  ready: boolean;

  // `undefined` when it's not our turn and for backward compatibility
  // (older matches won't have that field).
  turnBeganAt?: number;

  // `undefined` when it's not our turn and for backward compatibility
  turnExpiresAt?: number;

  // Is the player voting to end the match?
  votesToEndMatch?: boolean;

  // Is it a bot?
  // TODO: deprecate this, `meta` shouldn't care if the player is a bot or human
  // That info should go in the separate `User` data, along with the username.
  // The logic is that we should be able to swap a human player with a bot without
  // changing `meta`.
  isBot: boolean;
}

// Meta info about a match
export type Meta = {
  players: Players;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;

  // Kept for backward compatibility, those are not used anymore.
  settings?: {
    botMoveDuration?: number;
  };

  // Locale of the site when the match was created.
  // For some games we use this locale to determine which locale to use in the match.
  // Optional only for backward compatibility: older matches won't have this field.
  locale?: Locale;
};

export const metaInitialState = ({
  matchSettings = {},
  locale,
}: {
  matchSettings?: MatchSettings;
  locale: Locale;
}): Meta => {
  return {
    // Use `metaAddUserToMatch` and `metaRemoveUserFromMatch` to change those.
    players: {
      byId: {},
      allIds: [],
    },
    matchSettings,
    matchPlayersSettings: {},
    settings: {},
    locale,
  };
};

export const metaAddUserToMatch = ({
  meta,
  userId,
  matchPlayerSettings = {},
  isBot,
}: {
  meta: Meta;
  userId: UserId;
  ts: Date;
  matchPlayerSettings?: MatchPlayerSettings;
  isBot: boolean;
}): void => {
  // Make sure the user is not already in there, in case for some reason the user joined
  // twice very fast.
  if (meta.players.byId[userId] !== undefined) {
    return;
  }

  // Index at which we add the user. If it's a bot, we add them at the end. If it's a
  // human we add him before the bots.
  let index = 0;
  if (isBot) {
    index = meta.players.allIds.length;
  } else {
    index = 0;
    for (const otherUserId of meta.players.allIds) {
      if (meta.players.byId[otherUserId]?.isBot) {
        break;
      }
      index++;
    }
  }

  meta.players.byId[userId] = {
    ready: true,
    isBot,
  };
  meta.players.allIds.splice(index, 0, userId);
  meta.matchPlayersSettings[userId] = matchPlayerSettings;
};

export const metaRemoveUserFromMatch = (meta: Meta, userId: UserId): void => {
  delete meta.players.byId[userId];
  delete meta.matchPlayersSettings[userId];
  const idx = meta.players.allIds.indexOf(userId);

  // Sanity check.
  if (idx === -1) {
    console.warn(`userId "${userId}" not in allIds`);
    return;
  }

  meta.players.allIds.splice(idx, 1);
};

export const metaBeginTurn = ({
  meta,
  userId,
  beginsAt,
  expiresAt,
}: {
  meta: Meta;
  userId: UserId;
  beginsAt: number;
  expiresAt?: number;
}): void => {
  const player = meta.players.byId[userId];
  if (!player) {
    console.warn(
      `Trying to start turn for user ${userId} who is not in "meta"`,
    );
    return;
  }
  player.turnBeganAt = beginsAt;
  player.turnExpiresAt = expiresAt;
};

export const metaEndTurn = ({
  meta,
  userId,
}: {
  meta: Meta;
  userId: UserId;
}): void => {
  const player = meta.players.byId[userId];
  if (!player) {
    console.warn(`Trying to end turn for user ${userId} who is not in "meta"`);
    return;
  }
  player.turnBeganAt = undefined;
  player.turnExpiresAt = undefined;
};
