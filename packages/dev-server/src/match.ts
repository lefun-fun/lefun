import { Patch } from "immer";

import {
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  User,
  UserId,
  UsersState,
} from "@lefun/core";
import {
  executePlayerMove,
  Game_,
  MoveExecutionOutput,
  Random,
} from "@lefun/game";

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
  // TODO Deal with stats
  matchStats: { key: string; value: number }[];
  playerStats: Record<UserId, { key: string; value: number }[]>;
  // delayedMoves: DelayedMove[];
};

// We increment this every time we make backward incompatible changes in the match
// saved to local storage. We save this version with the match to later detect that
// a saved match is too old.
const VERSION = 4;

/* This class replaces our backend */
class Match extends EventTarget {
  random: Random;
  game: Game_;
  store: MatchStore;

  constructor({
    game,
    players,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    locale,
  }: {
    game: Game_;
    players: Record<UserId, User>;
    matchSettings: MatchSettings;
    matchPlayersSettings: MatchPlayersSettings;
    matchData: unknown;
    gameData: unknown;
    locale: Locale;
  });
  constructor({ game, store }: { game: Game_; store: MatchStore });
  constructor({
    game,
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

    // If a store is provided, there isn't much to do.
    if (store) {
      this.store = store;
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
      users,
      //
      matchStatus: "started",
      matchStats: [],
      playerStats: Object.fromEntries(userIds.map((userId) => [userId, []])),
    };
  }

  makeMove(userId: UserId, moveName: string, payload: any) {
    // Execute the move.
    const now = new Date().getTime();
    const { game, random, store } = this;
    const { meta, board, playerboards, secretboard, matchData, gameData } =
      store;

    let result: MoveExecutionOutput | null = null;
    try {
      result = executePlayerMove({
        name: moveName,
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
    } catch (e) {
      console.error(
        `Ignoring move "${moveName}" for user "${userId}" because of error`,
      );
      console.error(e);
    }

    if (result == null) {
      return;
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
          new CustomEvent(`move:${userId}`, { detail: { patches } }),
        );
        this.dispatchEvent(new CustomEvent("move"));
      }
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
  }

  serialize(): string {
    const { store } = this;
    return JSON.stringify({ store, version: VERSION });
  }

  static deserialize(str: string, game: Game_): Match {
    const obj = JSON.parse(str);
    const { store, version } = obj;

    // Currently we don't even try to maintain backward compatiblity here.
    if (version !== VERSION) {
      throw new Error(`unsupported version ${version}`);
    }

    return new Match({
      game,
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

function matchKey(gameId?: string) {
  return `match${gameId ? `.${gameId}` : ""}`;
}

function saveMatchToLocalStorage(match: Match, gameId?: string) {
  localStorage.setItem(matchKey(gameId), match.serialize());
}

function loadMatchFromLocalStorage(game: Game_, gameId?: string): Match | null {
  const str = localStorage.getItem(matchKey(gameId));

  if (!str) {
    return null;
  }

  try {
    return Match.deserialize(str, game);
  } catch (e) {
    console.warn("Failed to deserialize match", e);
    return null;
  }
}

export { loadMatchFromLocalStorage, Match, saveMatchToLocalStorage };
