export * from "./gameMessages";
export * from "./meta";
export * from "./types";

import { UserId } from "./types";

// FIXME this comment?
/*
 * This is the type returned by move functions created by the game developer.
 */

export type AnyMove = {
  name: string;
  payload: unknown;
}

export type AkaType = "similar" | "aka" | "inspired" | "original";

export type User = {
  username: string;
  isGuest: boolean;
  isBot?: boolean;
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
