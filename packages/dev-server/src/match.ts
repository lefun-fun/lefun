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

type EmptyObject = Record<string, never>;

type State<GS extends GameStateBase> = {
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"] | EmptyObject>;
  secretboard: GS["SB"] | EmptyObject;
};

class Match<
  GS extends GameStateBase,
  G extends Game<GS, any>,
> extends EventTarget {
  userIds: UserId[];
  random: Random;
  game: G;

  // Store that represents the backend.
  // We need to put it in a zustand Store because we want the JSON view in the right
  // panel to refresh with changes of state.
  store: StoreApi<State<GS>>;

  // Note some of the constructors parameters in case we want to reset.
  matchData: any;
  gameData: any;

  constructor({
    players,
    game,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    locale,
    state,
    userIds,
  }: {
    players?: Record<UserId, User>;
    game: G;
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
    matchData?: any;
    gameData?: any;
    locale?: Locale;
    state?: State<GS>;
    userIds?: UserId[];
  }) {
    super();

    const random = new Random();
    this.random = random;

    this.game = game;
    this.userIds = userIds || [];
    this.matchData = matchData;
    this.gameData = gameData;

    this.store = createStore(() => (state || {}) as State<GS>);

    if (!state) {
      if (!players) {
        throw new Error("players required");
      }
      if (!matchSettings) {
        throw new Error("match settings required");
      }

      if (!matchPlayersSettings) {
        throw new Error("match players settings required");
      }

      if (!locale) {
        throw new Error("locale required");
      }

      this.userIds = Object.keys(players);
      const areBots = Object.fromEntries(
        Object.entries(players).map(([userId, { isBot }]) => [userId, !!isBot]),
      );

      // We do this once to make sure we have the same data for everyplayer.
      // Then we'll deep copy the boards to make sure they are not linked.
      const initialBoards = game.initialBoards({
        players: Object.keys(players),
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
        for (const userId of this.userIds) {
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

    const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
      this.userIds.map((userId) => [userId, []]),
    );
    patchesByUserId["spectator"] = [];

    if (executeNow) {
      // Also run `executeNow` on the local state.
      this.store.setState((state: State<GS>) => {
        const [newState, patches] = produceWithPatches(
          state,
          (draft: Draft<State<GS>>) => {
            const { board, playerboards } = draft;
            executeNow({
              // We have had issues with the combination of `setState` and
              // `produceWithPatches`. Copying the `payload` seems to work as a
              // workaround.
              payload: JSON.parse(JSON.stringify(payload)),
              userId,
              board: board as GS["B"],
              playerboard: playerboards[userId] as GS["PB"],
              delayMove: () => {
                console.warn("delayMove not implemented yet");
                return { ts: 0 };
              },
            });
          },
        );

        separatePatchesByUser({
          patches,
          userIds: this.userIds,
          ignoreUserId: userId,
          patchesOut: patchesByUserId,
        });
        return newState;
      });
    }

    if (execute) {
      const { store, random, matchData, gameData } = this;
      store.setState((state: State<GS>) => {
        const [newState, patches] = produceWithPatches(
          state,
          (
            draft: Draft<{
              board: GS["B"];
              playerboards: Record<UserId, GS["PB"]>;
              secretboard: GS["SB"];
            }>,
          ) => {
            const { board, playerboards, secretboard } = draft;
            execute({
              payload,
              userId,
              board: board as GS["B"],
              playerboards: playerboards as Record<UserId, GS["PB"]>,
              secretboard: secretboard as GS["SB"],
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
          userIds: this.userIds,
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
    const { userIds, matchData, gameData } = this;
    return JSON.stringify({ state, userIds, matchData, gameData });
  }

  static deserialize(str: string, game: Game<any, any>): Match<any, any> {
    const obj = JSON.parse(str);
    const { state, userIds, matchData, gameData } = obj;
    return new Match({ state, userIds, matchData, gameData, game });
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

/* Save match to localStorage */
function saveMatch(match: Match<any, any>) {
  localStorage.setItem("match", match.serialize());
}

/* Load match from localStorage */
function loadMatch(game: Game<any, any>): Match<any, any> | null {
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

export { loadMatch, Match, saveMatch };
