import { Draft, Patch, produceWithPatches } from "immer";
import { createStore, StoreApi } from "zustand";

import {
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  User,
  UserId,
} from "@lefun/core";
import {
  GameDef,
  GameStateBase,
  PlayerMoveDefs,
  PlayerMoveName,
  PlayerMovePayload,
  Random,
} from "@lefun/game";

type EmptyObject = Record<string, never>;

type State<GS extends GameStateBase> = {
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"] | EmptyObject>;
  secretboard: GS["SB"] | EmptyObject;
};

class Match<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, BMT>,
  BMT,
> extends EventTarget {
  userIds: UserId[];
  random: Random;
  // FIXME
  gameDef: GameDef<GS, any>;

  // Store that represents the backend.
  // We need to put it in a zustand Store because we want the JSON view in the right
  // panel to refresh with changes of state.
  store: StoreApi<State<GS>>;

  // Note some of the constructors parameters in case we want to reset.
  matchData: any;

  constructor({
    state,
    gameDef,
    userIds,
  }: {
    state: State<GS>;
    // FIXME
    gameDef: GameDef<GS, any>;
    userIds: UserId[];
  });
  constructor({
    players,
    gameDef,
    matchSettings,
    matchPlayersSettings,
    matchData,
    locale,
  }: {
    players: Record<UserId, User>;
    // FIXME
    gameDef: GameDef<GS, any>;
    matchSettings: MatchSettings;
    matchPlayersSettings: MatchPlayersSettings;
    matchData?: any;
    locale: Locale;
  });
  constructor({
    players,
    gameDef,
    matchSettings,
    matchPlayersSettings,
    matchData,
    locale,
    state,
    userIds,
  }: {
    players?: Record<UserId, User>;
    // FIXME
    gameDef: GameDef<GS, any>;
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
    matchData?: any;
    locale?: Locale;
    state?: State<GS>;
    userIds?: UserId[];
  }) {
    super();

    const random = new Random();
    this.random = random;

    this.gameDef = gameDef;
    this.userIds = userIds || [];

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
      const {
        board,
        playerboards = {},
        secretboard = {},
      } = gameDef.initialBoards({
        players: Object.keys(players),
        matchSettings,
        matchPlayersSettings,
        matchData,
        random,
        areBots,
        gameData: undefined,
        locale,
      });

      this.store = createStore(() => ({
        board,
        playerboards,
        secretboard,
      }));
    }
  }

  makeMove<K extends PlayerMoveName<GS, PM>>(
    userId: UserId,
    name: K,
    payload: PlayerMovePayload<GS, PM, K>,
  ) {
    const now = new Date().getTime();

    // Here the `store` is the store for the player making the move, since
    // we're in the `useMakeMove` hook that points to the store from the context.
    if (userId === undefined) {
      throw new Error("we still have bugs with those userId in moves");
    }

    if (!this.store) {
      throw new Error("no store");
    }

    const { executeNow, execute } = this.gameDef.playerMoves[name];

    const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
      this.userIds.map((userId) => [userId, []]),
    );

    if (executeNow) {
      // Also run `executeNow` on the local state.
      this.store.setState((state: State<GS>) => {
        const [newState, patches] = produceWithPatches(
          state,
          (draft: Draft<State<GS>>) => {
            const { board, playerboards } = draft;
            executeNow({
              payload,
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

        separatePatchesByUser(patches, this.userIds, userId, patchesByUserId);
        return newState;
      });
    }

    if (execute) {
      const { store, random } = this;
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
              gameData: undefined,
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
        separatePatchesByUser(patches, this.userIds, null, patchesByUserId);
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
}

function separatePatchesByUser(
  patches: Patch[],
  userIds: UserId[],
  ignoreUserId: UserId | null = null,
  patchesOut: Record<UserId, Patch[]>,
) {
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
function saveMatch(match: Match<any, any, any>) {
  const state = match.store.getState();
  const userIds = match.userIds;
  localStorage.setItem("match", JSON.stringify({ state, userIds }));
}

/* Load match from localStorage */
function loadMatch(
  // FIXME
  gameDef: GameDef<any, any>,
): Match<any, any, any> | null {
  const data = localStorage.getItem("match");
  if (!data) {
    return null;
  }

  const { userIds, state } = JSON.parse(data);

  if (!state) {
    return null;
  }

  return new Match({ gameDef, state, userIds });
}

export { loadMatch, Match, saveMatch };
