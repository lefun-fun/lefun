import { Patch } from "immer";

import {
  GameId,
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  metaSetTurns,
  User,
  UserId,
  UsersState,
} from "@lefun/core";
import {
  DelayedMove,
  executeBoardMove,
  executePlayerMove,
  Game_,
  MoveExecutionOutput,
  Random,
} from "@lefun/game";

import { generateId } from "./utils";

// This is what would normally go in a database.
type MatchStore = {
  board: unknown;
  playerboards: Record<UserId, unknown>;
  secretboard: unknown;
  //
  meta: Meta;
  matchData: unknown;
  gameData: unknown;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;
  //
  users: UsersState;
  //
  // Simplified match statuses.
  matchStatus: "started" | "over";
  matchStats: { key: string; value: number }[];
  playerStats: Record<UserId, { key: string; value: number }[]>;
  // <id> => delayedMove
  // We need an id to be able to remove them on execution.
  delayedMoves: Record<string, DelayedMove>;
};

// We increment this every time we make backward incompatible changes in the match
// saved to local storage. We save this version with the match to later detect that
// a saved match is too old.
const VERSION = 5;

/* This class replaces our backend */
class Match extends EventTarget {
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
    players: Record<UserId, User>;
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
    players?: Record<UserId, User>;
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
      Object.entries(players).map(([userId, { isBot }]) => [userId, !!isBot]),
    );

    const userIds = Object.keys(players);

    const meta = metaInitialState({ matchSettings, locale });
    const ts = new Date();
    for (const userId of userIds) {
      metaAddUserToMatch({ meta, userId, ts, isBot: false });
    }

    const users: UsersState = {
      byId: players,
    };

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
    const playerboards =
      initialBoards.playerboards ||
      Object.fromEntries(userIds.map((userId) => [userId, {}]));

    this.store = {
      meta,
      users,
      //
      matchSettings,
      matchPlayersSettings,
      //
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
      this.dispatchEvent(new CustomEvent("move"));
      return;
    }

    if (!delayedMove) {
      throw new Error(`Unknown move "${delayedMoveId}"`);
    }

    const { userId, payload, name, type } = delayedMove;

    if (type === "playerMove") {
      try {
        this.makeMove({ userId, name, payload });
      } catch (e) {
        console.error("error in delayed player move", e);
      } finally {
        this._removeDelayedMove(delayedMoveId);
      }
    } else if (type === "boardMove") {
      try {
        this.makeBoardMove(name, payload);
      } catch (e) {
        console.error("error in delayed board move", e);
      } finally {
        this._removeDelayedMove(delayedMoveId);
      }
    } else {
      throw new Error(`Unknown delayed move type "${type}"`);
    }
  }

  /* Both player and board moves */
  _makeMove(
    name: string,
    payload: any,
    userId: UserId | null = null,
    moveId?: string,
  ) {
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

    // Send out patches to users.
    {
      const userIds = store.meta.players.allIds;
      const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
        userIds.map((userId) => [userId, []]),
      );
      patchesByUserId["spectator"] = [];

      const { patches } = result;

      separatePatchesByUser({
        patches,
        userIds,
        patchesOut: patchesByUserId,
      });

      for (const [userId, patches] of Object.entries(patchesByUserId)) {
        if (patches.length === 0) {
          continue;
        }
        this.dispatchEvent(
          new CustomEvent(`patches:${userId}`, { detail: { moveId, patches } }),
        );
      }
      // This is for the dev server state view so that it knows it needs to update.
      this.dispatchEvent(new CustomEvent("move"));
    }

    // Has the match ended?
    if (result.matchHasEnded) {
      this.store.matchStatus = "over";
    }

    // Are there any stats?
    for (const stat of result.stats) {
      const { key, value, userId } = stat;
      if (userId) {
        this.store.playerStats[userId].push({ key, value });
      } else {
        this.store.matchStats.push({ key, value });
      }
    }

    // Turns
    metaSetTurns({
      meta,
      userIds: Array.from(result.beginTurnUsers),
      value: true,
    });

    metaSetTurns({
      meta,
      userIds: Array.from(result.endTurnUsers),
      value: false,
    });

    if (result.beginTurnUsers.size > 0 || result.endTurnUsers.size > 0) {
      this.dispatchEvent(new CustomEvent("metaChanged"));
    }

    // Also cancel move expiry timeouts for users whose turn has ended.
    for (const userId of result.endTurnUsers) {
      this._removeDelayedMoveForUser(userId);
    }

    for (const userId of result.beginTurnUsers) {
      this._removeDelayedMoveForUser(userId);
    }

    // Delayed moves
    for (const delayedMove of result.delayedMoves) {
      this._addDelayedMove(delayedMove);
    }

    saveMatchToLocalStorage(this, this.gameId);
  }

  makeBoardMove(name: string, payload: any) {
    console.warn("board move", name, payload);
    this._makeMove(name, payload, null);
  }

  makeMove({
    userId,
    name,
    payload,
    moveId,
  }: {
    userId: UserId;
    name: string;
    payload: any;
    moveId?: string;
  }) {
    console.warn("move", name, payload, "by user", userId);
    try {
      this._makeMove(name, payload, userId, moveId);
    } catch (e) {
      console.error("There was an error executing move", name, e);
      this.dispatchEvent(new CustomEvent("revertMove", { detail: { moveId } }));
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
    this.store.delayedMoves[delayedMoveId];
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

  static _deserialize(str: string, game: Game_, gameId: GameId): Match {
    const obj = JSON.parse(str);
    const { store, version } = obj;

    // Currently we don't even try to maintain backward compatiblity here.
    if (version !== VERSION) {
      throw new Error(`unsupported version ${version}`);
    }

    return new Match({
      game,
      gameId,
      store,
    });
  }
}

export function separatePatchesByUser({
  patches,
  userIds,
  ignoreUserId = null,
  patchesOut,
}: {
  patches: Patch[];
  userIds: UserId[];
  ignoreUserId?: UserId | null;
  patchesOut: Record<UserId, Patch[]>;
}) {
  for (const patch of patches) {
    const { path } = patch;
    const [p0, p1, ...rest] = path;
    // "board" patches, we send those to everyone but the user making the move.
    if (p0 === "board") {
      for (const userId of userIds) {
        if (userId !== ignoreUserId) {
          patchesOut[userId].push(patch);
        }
      }
      patchesOut["spectator"].push(patch);
    }
    // Send 'playerboards' patches to concerned players.
    else if (p0 === "playerboards") {
      if (p1 !== ignoreUserId) {
        patchesOut[p1].push({ ...patch, path: ["playerboard", ...rest] });
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

function saveMatchToLocalStorage(match: Match, gameId?: string) {
  localStorage.setItem(_matchKey(gameId), match._serialize());
}

function loadMatchFromLocalStorage(game: Game_, gameId: GameId): Match | null {
  const str = localStorage.getItem(_matchKey(gameId));

  if (!str) {
    return null;
  }

  try {
    return Match._deserialize(str, game, gameId);
  } catch (e) {
    console.warn("Failed to deserialize match", e);
    return null;
  }
}

export { loadMatchFromLocalStorage, Match, saveMatchToLocalStorage };
