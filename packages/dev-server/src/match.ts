import { Draft, Patch, produceWithPatches } from "immer";
import { createStore, StoreApi } from "zustand";

import {
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  User,
  UserId,
} from "@lefun/core";
import { Game_, MoveSideEffects, Random } from "@lefun/game";

type State = {
  board: unknown;
  playerboards: Record<UserId, unknown>;
  secretboard: unknown;
};

// We increment this every time we make backward incompatible changes in the match
// saved to local storage. We save this version with the match to later detect that
// a saved match is too old.
const VERSION = 2;

class Match extends EventTarget {
  random: Random;
  game: Game_;
  // These will be serialized with the Match.
  players: Record<UserId, User>;
  matchData: unknown;
  gameData: unknown;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;
  // Locale at the time of creating the match. This is not necessarily the same as the
  // current selected locale.
  locale: Locale;

  get numPlayers() {
    return Object.keys(this.players).length;
  }

  // Store that represents the backend.
  // We need to put it in a zustand Store because we want the JSON view in the right
  // panel to refresh with changes of state.
  store: StoreApi<State>;

  constructor({
    game,
    players,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    locale,
    //
    state,
  }: {
    game: Game_;
    players: Record<UserId, User>;
    matchSettings: MatchSettings;
    matchPlayersSettings: MatchPlayersSettings;
    matchData: unknown;
    gameData: unknown;
    locale: Locale;
    //
    state?: State;
  }) {
    super();

    const random = new Random();
    this.random = random;
    this.game = game;
    this.players = players;
    this.matchData = matchData;
    this.gameData = gameData;
    this.matchSettings = matchSettings;
    this.matchPlayersSettings = matchPlayersSettings;
    this.locale = locale;

    if (state) {
      this.store = createStore(() => state as State);
    } else {
      const areBots = Object.fromEntries(
        Object.entries(players).map(([userId, { isBot }]) => [userId, !!isBot]),
      );

      const userIds = Object.keys(players);

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
      let { playerboards } = initialBoards;

      if (!playerboards) {
        playerboards = {};
        for (const userId of userIds) {
          playerboards[userId] = {};
        }
      }

      this.store = createStore(() => ({
        board,
        playerboards,
        secretboard,
      }));
    }
  }

  makeMove(userId: UserId, moveName: string, payload: any) {
    const now = new Date().getTime();

    // Here the `store` is the store for the player making the move, since
    // we're in the `useMakeMove` hook that points to the store from the context.
    if (userId === undefined) {
      throw new Error("we still have bugs with those userId in moves");
    }

    if (!this.players[userId]) {
      console.warn(`user "${userId}" not in match`);
      return;
    }

    if (!this.store) {
      throw new Error("no store");
    }

    // TODO Reuse code from the `execution.ts` file.
    const { executeNow, execute } = this.game.playerMoves[moveName];

    const userIds = Object.keys(this.players);

    const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
      userIds.map((userId) => [userId, []]),
    );
    patchesByUserId["spectator"] = [];

    const sideEffects: MoveSideEffects = {
      delayMove() {
        console.warn("delayMove not implemented yet");
        return { ts: 0 };
      },
      endMatch() {
        console.warn("endMatch not implemented");
      },
      logPlayerStat() {
        console.warn("logPlayerStat not implemented");
      },
      logMatchStat() {
        console.warn("logMatchStat not implemented");
      },
      turns: {
        begin() {
          console.warn("turns.begin not implemented");
          return { expiresAt: 0 };
        },
        end() {
          console.warn("turns.end not implemented");
        },
      },
    };

    if (executeNow) {
      // Also run `executeNow` on the local state.
      this.store.setState((state: State) => {
        const [newState, patches] = produceWithPatches(
          state,
          (draft: Draft<State>) => {
            const { board, playerboards } = draft;
            executeNow({
              // We have had issues with the combination of `setState` and
              // `produceWithPatches`. Copying the `payload` seems to work as a
              // workaround.
              payload: JSON.parse(JSON.stringify(payload)),
              userId,
              board,
              playerboard: playerboards[userId],
              _: sideEffects,
              ...sideEffects,
            });
          },
        );

        separatePatchesByUser({
          patches,
          userIds,
          ignoreUserId: userId,
          patchesOut: patchesByUserId,
        });
        return newState;
      });
    }

    if (execute) {
      const { matchData, gameData, random, store } = this;
      store.setState((state: State) => {
        const [newState, patches] = produceWithPatches(
          state,
          (
            draft: Draft<{
              board: unknown;
              playerboards: Record<UserId, unknown>;
              secretboard: unknown;
            }>,
          ) => {
            const { board, playerboards, secretboard } = draft;
            execute({
              payload,
              userId,
              board,
              playerboards,
              secretboard,
              matchData,
              gameData,
              random,
              ts: now,
              _: sideEffects,
              ...sideEffects,
            });
          },
        );
        separatePatchesByUser({
          patches,
          userIds,
          patchesOut: patchesByUserId,
        });
        return newState;
      });
    }

    for (const [userId, patches] of Object.entries(patchesByUserId)) {
      if (patches.length === 0) {
        continue;
      }
      this.dispatchEvent(
        new CustomEvent(`move:${userId}`, { detail: { patches } }),
      );
    }

    return patchesByUserId;
  }

  serialize(): string {
    const state = this.store.getState();
    const {
      players,
      matchData,
      gameData,
      matchSettings,
      matchPlayersSettings,
    } = this;
    return JSON.stringify({
      state,
      players,
      matchData,
      gameData,
      // gameId,
      matchSettings,
      matchPlayersSettings,
      version: VERSION,
    });
  }

  static deserialize(str: string, game: Game_): Match {
    const obj = JSON.parse(str);
    const {
      state,
      players,
      matchData,
      gameData,
      matchSettings,
      matchPlayersSettings,
      locale,
      version,
    } = obj;

    // Currently we don't even try to maintain backward compatiblity here.
    if (version !== VERSION) {
      throw new Error(`unsupported version ${version}`);
    }

    return new Match({
      state,
      players,
      matchData,
      gameData,
      game,
      matchSettings,
      matchPlayersSettings,
      locale,
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
