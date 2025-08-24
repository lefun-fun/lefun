export * from "./gameMessages";
export * from "./meta";
export * from "./types";

import { UserId } from "./types";

export type AkaType = "similar" | "aka" | "inspired" | "original";

export type User = {
  username: string;
  isGuest: boolean;
  isBot: boolean;

  turnBeganAt: number | undefined;
  turnExpiresAt: number | undefined;
};

export type UsersState = { byId: Record<UserId, User> };

/*
 * State of the match as seen from a player.
 * This is what the game UI has access to.
 * Note that there is a version with less `undefined` values in `@lefun/ui`, for use by
 * game developers.
 */
export type MatchState<B = unknown, PB = unknown> = {
  // The player's userid
  userId?: UserId;
  board?: B;
  // The player's own board.
  playerboard?: PB;
  users: UsersState;

  // Timing info with respect to the
  timeDelta?: number;
  timeLatency?: number;
};
