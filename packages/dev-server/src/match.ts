import { Draft, Patch, produceWithPatches } from "immer";
import { createStore, StoreApi } from "zustand";

import {
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  User,
  UserId,
} from "@lefun/core";
import { Game, GameStateBase, Random } from "@lefun/game";

type State = {
  board: unknown;
  playerboards: Record<UserId, unknown>;
  secretboard: unknown;
};

type G = Game<GameStateBase, any>;

class Match extends EventTarget {
  random: Random;
  game: G;
  players: Record<UserId, User>;
  matchData: unknown;
  gameData: unknown;

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
    game: G;
    players: Record<UserId, User>;
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
    matchData?: unknown;
    gameData?: unknown;
    locale?: Locale;
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

    if (state) {
      this.store = createStore(() => state as State);
    } else {
      // If no saved `state was provided, we need to create everything from scratch.
      if (!matchSettings) {
        throw new Error("match settings required");
      }

      if (!matchPlayersSettings) {
        throw new Error("match players settings required");
      }

      if (!locale) {
        throw new Error("locale required");
      }

      if (!players) {
        throw new Error("players required");
      }

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

    if (!this.store) {
      throw new Error("no store");
    }

    const { executeNow, execute } = this.game.playerMoves[moveName];

    const userIds = Object.keys(this.players);

    const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
      userIds.map((userId) => [userId, []]),
    );
    patchesByUserId["spectator"] = [];

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
              delayMove: () => {
                console.warn("delayMove not implemented yet");
                return { ts: 0 };
              },
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
      const { store, random, matchData, gameData } = this;
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
              delayMove: () => {
                console.warn("delayMove not implemented yet");
                return { ts: 0 };
              },
              endMatch: () => {
                console.warn("todo implement endMatch");
              },
              itsYourTurn: () => {
                console.warn("todo implement itsYourTurn");
              },
              logStat: () => {
                console.warn("todo implement logStats");
              },
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
    const { players, matchData, gameData } = this;
    return JSON.stringify({ state, players, matchData, gameData });
  }

  static deserialize(str: string, game: Game<any, any>): Match {
    const obj = JSON.parse(str);
    const { state, players, matchData, gameData } = obj;
    return new Match({ state, players, matchData, gameData, game });
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

function saveMatchToLocalStorage(match: Match) {
  localStorage.setItem("match", match.serialize());
}

function loadMatchFromLocalStorage(game: Game<any, any>): Match | null {
  const str = localStorage.getItem("match");

  if (!str) {
    return null;
  }

  try {
    return Match.deserialize(str, game);
  } catch (e) {
    console.error("Failed to deserialize match", e);
    return null;
  }
}

export { loadMatchFromLocalStorage, Match, saveMatchToLocalStorage };
