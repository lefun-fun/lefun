import { Draft, Patch, produceWithPatches } from "immer";
import { createStore, StoreApi } from "zustand";

import {
  Locale,
  MatchPlayersSettings,
  MatchSettings,
  Move,
  User,
  UserId,
} from "@lefun/core";
import { GameDef, Random } from "@lefun/game";

type EmptyObject = Record<string, never>;

type State<B, PB, SB> = {
  board: B;
  playerboards: Record<UserId, PB | EmptyObject>;
  secretboard: SB | EmptyObject;
};

class Match<B, PB, SB> extends EventTarget {
  userIds: UserId[];
  random: Random;
  gameDef: GameDef<B, PB, SB>;

  // Store that represents the backend.
  // We need to put it in a zustand Store because we want the JSON view in the right
  // panel to refresh with changes of state.
  store: StoreApi<State<B, PB, SB>>;

  // Note some of the constructors parameters in case we want to reset.
  matchData: any;

  constructor({
    state,
    gameDef,
    userIds,
  }: {
    state: State<B, PB, SB>;
    gameDef: GameDef<B, PB, SB>;
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
    gameDef: GameDef<B, PB, SB>;
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
    gameDef: GameDef<B, PB, SB>;
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
    matchData?: any;
    locale?: Locale;
    state?: State<B, PB, SB>;
    userIds?: UserId[];
  }) {
    super();

    const random = new Random();
    this.random = random;

    this.gameDef = gameDef;
    this.userIds = userIds || [];

    this.store = createStore(() => (state || {}) as State<B, PB, SB>);

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

  makeMove(userId: UserId, move: Move) {
    const now = new Date().getTime();

    // Here the `store` is the store for the player making the move, since
    // we're in the `useMakeMove` hook that points to the store from the context.
    if (userId === undefined) {
      throw new Error("we still have bugs with those userId in moves");
    }

    if (!this.store) {
      throw new Error("no store");
    }

    const { name, payload } = move;
    const { executeNow, execute } = this.gameDef.moves[name];

    const patchesByUserId: Record<UserId, Patch[]> = Object.fromEntries(
      this.userIds.map((userId) => [userId, []]),
    );

    if (executeNow) {
      // Also run `executeNow` on the local state.
      this.store.setState((state: State<B, PB, SB>) => {
        const [newState, patches] = produceWithPatches(
          state,
          (draft: Draft<State<B, PB, SB>>) => {
            const { board, playerboards } = draft;
            executeNow({
              payload,
              userId,
              board: board as B,
              playerboard: playerboards[userId] as PB,
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
      store.setState((state: State<B, PB, SB>) => {
        const [newState, patches] = produceWithPatches(
          state,
          (
            draft: Draft<{
              board: B;
              playerboards: Record<UserId, PB>;
              secretboard: SB;
            }>,
          ) => {
            const { board, playerboards, secretboard } = draft;
            execute({
              payload,
              userId,
              board: board as B,
              playerboards: playerboards as Record<UserId, PB>,
              secretboard: secretboard as SB,
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
function saveMatch<B, PB, SB>(match: Match<B, PB, SB>) {
  const state = match.store.getState();
  const userIds = match.userIds;
  localStorage.setItem("match", JSON.stringify({ state, userIds }));
}

/* Load match from localStorage */
function loadMatch<B, PB, SB>(
  gameDef: GameDef<B, PB, SB>,
): Match<B, PB, SB> | null {
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
