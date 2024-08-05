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

  // Score for the player at the end of the match.
  // What it means depends on the type of score as defined in the Game.
  // See
  score?: number;

  // Rank of the player for the match. Even though this can be deduced
  // from the `score`, having it here makes que user stats per rank easy to fetch.
  rank?: number;

  // Is it this player's turn?
  // This is used to:
  // * Trigger the "it's your turn" sounds
  // * Show the player that it's their turn
  // * It is NOT used to check for permission of making moves
  itsYourTurn: boolean;

  // After coming out of the internet the date is in a string.
  joinedAt: Date | string;

  // Is the player voting to end the match?
  votesToEndMatch?: boolean;

  // Is it a bot?
  isBot: boolean;
}

// Meta info about a match
export type Meta = {
  players: Players;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;

  // Score for the match. This makes sense for collaborative/solo matches. We could put
  // the best score in the "game" page.
  score?: number;

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
  ts,
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
      if (meta.players.byId[otherUserId].isBot) {
        break;
      }
      index++;
    }
  }

  meta.players.byId[userId] = {
    ready: true,
    itsYourTurn: false,
    joinedAt: ts,
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

export const metaSetTurns = ({
  meta,
  userIds,
  value,
}: {
  meta: Meta;
  userIds: UserId | UserId[] | "all";
  value: boolean;
}): void => {
  if (userIds === "all") {
    userIds = meta.players.allIds;
  } else if (!Array.isArray(userIds)) {
    userIds = [userIds];
  }

  for (const userId of userIds) {
    const player = meta.players.byId[userId];
    if (!player) {
      console.warn(
        `Trying to set itsYourTurn for user ${userId} who is not in "meta"`,
      );
      continue;
    }
    player.itsYourTurn = value;
  }
};
