import { Patch } from "immer";

import {
  GameId,
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  UserId,
} from "@lefun/core";
import {
  DelayedMove,
  executeBoardMove,
  executePlayerMove,
  Game_,
  MoveExecutionOutput,
  Random,
  updateMetaWithTurnInfo,
} from "@lefun/game";
import { User } from "@lefun/ui";

import { generateId } from "./utils";

type Player = {
  userId: UserId;
  isBot: boolean;
  username: string;
};

type DelayedMoveId = string;

// This is what would normally go in a database.
type MatchStore = {
  board: object;
  playerboards: Record<UserId, object | null>;
  secretboard: object | null;
  meta: Meta;
  matchData: unknown;
  gameData: unknown;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;

  // This represents the Users in the database.
  users: Record<UserId, User>;

  // Simplified match statuses.
  matchStatus: "started" | "over";

  matchStats: { key: string; value: number }[];
  playerStats: Record<UserId, { key: string; value: number }[]>;

  // We need an id to be able to remove them on execution.
  delayedMoves: Record<DelayedMoveId, DelayedMove>;
};

// We increment this every time we make backward incompatible changes in the match
// saved to local storage. We save this version with the match to later detect that
// a saved match is too old.
const VERSION = 6;

// Events
export const patchesForUserEvent = (userId: UserId) => `PATCHES/${userId}`;
export const REVERT_MOVE_EVENT = "REVERT_MOVE";
export const MOVE_EVENT = "MOVE";

/*
 * Simulates the backend.
 *
 * It holds the ground truth about the match state.
 * Views can listen to events on it to update themselves.
 * */
class Backend extends EventTarget {
  random: Random;
  game: Game_;
  gameId: GameId;
  store: MatchStore;
  // We note what user has an on expiry delayed move.
  // This is necessary to be able to cancel these delayed move when a
  // user's turn ends.
  onExpiryDelayedMoves: Record<
    UserId,
    { timeout: ReturnType<typeof setTimeout>; delayedMoveId: string }
  >;

  constructor({
    game,
    gameId,
    players,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    locale,
  }: {
    game: Game_;
    gameId: GameId;
    players: Player[];
    matchSettings: MatchSettings;
    matchPlayersSettings: MatchPlayersSettings;
    matchData: unknown;
    gameData: unknown;
    locale: Locale;
  });
  constructor({
    game,
    gameId,
    store,
  }: {
    game: Game_;
    gameId: GameId;
    store: MatchStore;
  });
  constructor({
    game,
    gameId,
    players,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    locale,
    //
    store,
  }: {
    game: Game_;
    gameId: GameId;
    players?: Player[];
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
    matchData?: unknown;
    gameData?: unknown;
    locale?: Locale;
    //
    store?: MatchStore;
  }) {
    super();

    const random = new Random();
    this.random = random;
    this.game = game;
    this.gameId = gameId;
    this.onExpiryDelayedMoves = {};

    // If a store is provided, there isn't much to do.
    if (store) {
      this.store = store;

      // Start the timeouts for the delayed move.
      for (const [delayedMoveId, delayedMove] of Object.entries(
        store.delayedMoves,
      )) {
        const { userId, ts } = delayedMove;
        // Those that happen on turn expiry.
        const delay = ts - new Date().getTime();
        const timeout = setTimeout(() => {
          this._executeDelayedMove(delayedMoveId);
        }, delay);
        if (userId) {
          this.onExpiryDelayedMoves[userId] = { timeout, delayedMoveId };
        }
      }

      return;
    }

    // If this is a brand new match, then we initialize all the parts of the store.
    if (!players || !locale || !matchSettings || !matchPlayersSettings) {
      throw new Error("everything should be defined");
    }

    const areBots = Object.fromEntries(
      players.map(({ userId, isBot }) => [userId, !!isBot]),
    );

    const userIds = players.map(({ userId }) => userId);

    const meta = metaInitialState({ matchSettings, locale });
    const ts = new Date();
    for (const userId of userIds) {
      metaAddUserToMatch({ meta, userId, ts, isBot: false });
    }

    // We do this once to make sure we have the same data for everyplayer.
    // Then we'll deep copy the boards to make sure they are not linked.
    const initialBoards = game.initialBoards({
      players: userIds,
      matchSettings,
      matchPlayersSettings,
      matchData,
      gameData,
      random,
      areBots,
      locale,
      ts: new Date().getTime(),
    });

    const { board, secretboard = {} } = initialBoards;
    const playerboards: Record<UserId, object | null> =
      initialBoards.playerboards ||
      Object.fromEntries(userIds.map((userId) => [userId, null]));

    const users = Object.fromEntries(
      players.map(({ userId, username, isBot }) => [
        userId,
        { username, isBot },
      ]),
    );

    this.store = {
      users,
      //
      matchSettings,
      matchPlayersSettings,
      //
      meta,
      board,
      playerboards,
      secretboard,
      //
      matchData,
      gameData,
      //
      matchStatus: "started",
      matchStats: [],
      playerStats: Object.fromEntries(userIds.map((userId) => [userId, []])),
      delayedMoves: {},
    };
  }

  _executeDelayedMove(delayedMoveId: string) {
    const delayedMove = this.store.delayedMoves[delayedMoveId];

    if (this.store.matchStatus === "over") {
      console.warn(
        `Ignoring delayed move "${delayedMoveId}" because match is over`,
      );
      this._removeDelayedMove(delayedMoveId);
      // Force refresh of the list of delayed moves.
      this.dispatchEvent(new CustomEvent(MOVE_EVENT));
      return;
    }

    if (!delayedMove) {
      throw new Error(`Unknown move "${delayedMoveId}"`);
    }

    const { userId, payload, name, type } = delayedMove;

    if (type === "playerMove") {
      try {
        this.makeMove({
          userId,
          name,
          payload,
          isExpiration: true,
          moveId: undefined,
        });
      } catch (e) {
        console.error("error in delayed player move", e);
      } finally {
        this._removeDelayedMove(delayedMoveId);
      }
    } else if (type === "boardMove") {
      try {
        this.makeBoardMove(name, payload, { isExpiration: true });
      } catch (e) {
        console.error("error in delayed board move", e);
      } finally {
        this._removeDelayedMove(delayedMoveId);
      }
    } else {
      throw new Error(`Unknown delayed move type`);
    }
  }

  /* Both player and board moves */
  _makeMove({
    userId,
    name,
    payload,
    moveId,
    isExpiration,
  }: {
    userId: UserId | null;
    name: string;
    payload: any;
    moveId: string | undefined;
    isExpiration: boolean;
  }) {
    if (this.store.matchStatus == "over") {
      throw new Error("match is over");
    }
    // Execute the move.
    const now = new Date().getTime();
    const { game, random, store } = this;
    const { meta, board, playerboards, secretboard, matchData, gameData } =
      store;

    let result: MoveExecutionOutput | null = null;
    if (userId) {
      result = executePlayerMove({
        name,
        payload,
        game,
        now,
        userId,
        board,
        playerboards,
        secretboard,
        random,
        meta,
        matchData,
        gameData,
        isExpiration,
      });
    } else {
      result = executeBoardMove({
        name,
        payload,
        game,
        now,
        board,
        playerboards,
        secretboard,
        random,
        meta,
        matchData,
        gameData,
        isExpiration,
      });
    }

    if (!result) {
      throw new Error("bug");
    }

    // Update the store.
    {
      const { board, playerboards, secretboard } = result;
      store.board = board;
      store.playerboards = playerboards;
      store.secretboard = secretboard;
    }

    // Update meta
    const { beginTurn, endTurn } = result;
    const { meta: newMeta, patches: metaPatches } = updateMetaWithTurnInfo({
      meta,
      beginTurn,
      endTurn,
      now,
    });

    store.meta = newMeta;

    // Send out patches to users.
    {
      const userIds = store.meta.players.allIds;
      const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
        userIds.map((userId) => [userId, []]),
      );
      patchesByUserId["spectator"] = [];

      const { patches } = result;

      separatePatchesByUser({
        patches: [...patches, ...metaPatches],
        userIds,
        patchesOut: patchesByUserId,
      });

      // Add the `meta` patches to everyone.

      for (const [userId, patches] of Object.entries(patchesByUserId)) {
        if (patches.length === 0) {
          continue;
        }
        this.dispatchEvent(
          new CustomEvent(patchesForUserEvent(userId), {
            detail: { moveId, patches },
          }),
        );
      }
      // This is for the dev server state view so that it knows it needs to update.
      this.dispatchEvent(new CustomEvent(MOVE_EVENT));
    }

    // Has the match ended?
    if (result.matchHasEnded) {
      this.store.matchStatus = "over";
    }

    // Are there any stats?
    for (const stat of result.stats) {
      const { key, value, userId } = stat;
      if (userId) {
        this.store.playerStats[userId]!.push({ key, value });
      } else {
        this.store.matchStats.push({ key, value });
      }
    }

    // Also cancel move expiry timeouts for users whose turn has ended.
    for (const userId of Object.keys(result.endTurn)) {
      this._removeDelayedMoveForUser(userId);
    }

    for (const userId of Object.keys(result.beginTurn)) {
      this._removeDelayedMoveForUser(userId);
    }

    // Delayed moves
    for (const delayedMove of result.delayedMoves) {
      this._addDelayedMove(delayedMove);
    }

    saveBackendToLocalStorage(this, this.gameId);
  }

  makeBoardMove(
    name: string,
    payload: any,
    { isExpiration }: { isExpiration: boolean },
  ) {
    console.warn("board move", name, payload);
    this._makeMove({
      name,
      payload,
      userId: null,
      moveId: undefined,
      isExpiration,
    });
  }

  /* Player move */
  makeMove({
    userId,
    name,
    payload,
    moveId,
    isExpiration,
  }: {
    userId: UserId;
    name: string;
    payload: any;
  } & (
    | {
        moveId: string;
        isExpiration: false;
      }
    | {
        moveId: undefined;
        isExpiration: true;
      }
  )) {
    console.warn("move", name, payload, "by user", userId);
    try {
      this._makeMove({ name, payload, userId, moveId, isExpiration });
    } catch (e) {
      console.error("There was an error executing move", name, e);
      this.dispatchEvent(
        new CustomEvent(REVERT_MOVE_EVENT, { detail: { moveId } }),
      );
    }
  }

  _addDelayedMove(delayedMove: DelayedMove) {
    const { userId, ts } = delayedMove;
    const delayedMoveId = generateId();

    this.store.delayedMoves[delayedMoveId] = delayedMove;

    const timeout = setTimeout(() => {
      this._executeDelayedMove(delayedMoveId);
    }, ts - new Date().getTime());

    if (userId) {
      // Remove any previous delayed move for this user.
      this._removeDelayedMoveForUser(userId);
      this.onExpiryDelayedMoves[userId] = { timeout, delayedMoveId };
    }
  }

  /* Remove a delayed move from the state, for instance after its execution. */
  _removeDelayedMove(delayedMoveId: string) {
    // If it's a delayed move on expiry, we also remove the item in the per
    // user object..
    const userDelayedMove = this.onExpiryDelayedMoves[delayedMoveId];
    if (userDelayedMove) {
      const { timeout } = userDelayedMove;
      clearTimeout(timeout);
      delete this.onExpiryDelayedMoves[delayedMoveId];
    }
    delete this.store.delayedMoves[delayedMoveId];
  }

  _removeDelayedMoveForUser(userId: UserId) {
    const userDelayedMove = this.onExpiryDelayedMoves[userId];
    if (userDelayedMove) {
      const { timeout, delayedMoveId } = userDelayedMove;
      clearTimeout(timeout);
      delete this.onExpiryDelayedMoves[userId];
      delete this.store.delayedMoves[delayedMoveId];
    }
  }

  _serialize(): string {
    const { store } = this;
    return JSON.stringify({ store, version: VERSION });
  }

  static _deserialize(str: string, game: Game_, gameId: GameId): Backend {
    const obj = JSON.parse(str);
    const { store, version } = obj;

    // Currently we don't even try to maintain backward compatiblity here.
    if (version !== VERSION) {
      throw new Error(`unsupported version ${version}`);
    }

    return new Backend({
      game,
      gameId,
      store,
    });
  }
}

export function separatePatchesByUser({
  patches,
  userIds,
  patchesOut,
}: {
  patches: Patch[];
  userIds: UserId[];
  patchesOut: Record<UserId, Patch[]>;
}) {
  for (const patch of patches) {
    const { path } = patch;
    const [p0, p1, ...rest] = path;
    // "board" and "meta" patches are sent to everyone.
    if (p0 === "board" || p0 === "meta") {
      for (const userId of userIds) {
        patchesOut[userId]!.push(patch);
      }
      patchesOut["spectator"]!.push(patch);
    }
    // Send 'playerboards' patches to concerned players.
    else if (p0 === "playerboards") {
      if (p1) {
        patchesOut[p1]!.push({ ...patch, path: ["playerboard", ...rest] });
      }
    } else if (p0 === "secretboard") {
      //
    } else {
      throw new Error(`unknown path${p0}`);
    }
  }
}

function _matchKey(gameId?: string) {
  return `match${gameId ? `.${gameId}` : ""}`;
}

function saveBackendToLocalStorage(match: Backend, gameId?: string) {
  localStorage.setItem(_matchKey(gameId), match._serialize());
}

function loadBackendFromLocalStorage(
  game: Game_,
  gameId: GameId,
): Backend | null {
  const str = localStorage.getItem(_matchKey(gameId));

  if (!str) {
    return null;
  }

  try {
    return Backend._deserialize(str, game, gameId);
  } catch (e) {
    console.warn("Failed to deserialize match", e);
    return null;
  }
}

export { Backend, loadBackendFromLocalStorage, saveBackendToLocalStorage };
