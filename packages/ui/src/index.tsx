import { createContext, useContext } from "react";
import { StoreApi, useStore as _useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { MatchState as _MatchState, UserId } from "@lefun/core";
import type {
  // GameDef,
  GameMove,
  GameMoves,
  GameState,
  GameStateDefault,
  MoveName,
  MovePayload,
  // FIXME make sure we rename these
  // GameStateDefault,
  // MoveName,
  // MovePayload,
  // PlayerMove,
} from "@lefun/game";

type AnyGameType = GameStateDefault<any, any, any>;
type UnknownGameType = GameStateDefault<unknown, unknown, unknown>;

// type EmptyObject = Record<string, never>;

// In the selectors, assume that the boards are defined. We will add a check in the
// client code to make sure this is true.
export type MatchState<GS extends GameState> = _MatchState<
  GS["B"],
  GS["PB"]
> & {
  userId: UserId;
  board: GS["B"];
  playerboard: GS["PB"];
};

export type Selector<GS extends GameState, T> = (state: MatchState<GS>) => T;

// TODO Type this properly
export type Store<GS extends GameState> = StoreApi<MatchState<GS>>;

// FIXME
export const storeContext = createContext<Store<UnknownGameType> | null>(null);

// type MakeMove<K extends string, P> = P extends EmptyObject
//   ? <K, P>(moveName: K, payload: P) => void
//   : <K>(moveName: K) => void;

// let _makeMove: (store: Store) => MakeMove;
// type AnyGameState = GameStateDefault<any, any, any>

type GameMoveWithOptionalPayload<
  GS extends GameState,
  GM extends GameMoves<GS>,
  K extends MoveName<GS, GM>,
> = [MovePayload<GS, GM, K>[keyof MovePayload<GS, GM, K>]] extends [never]
  ? Optional<GameMove<GS, GM, K>, "payload">
  : GameMove<GS, GM, K>;

let _makeMove: <
  GS extends GameState,
  GM extends GameMoves<GS>,
  K extends MoveName<GS, GM>,
>(
  store: Store<AnyGameType>,
) => (move: GameMoveWithOptionalPayload<GS, GM, K>) => void;

// export function setMakeMove<GS extends GameState, GM extends GameMoves<GS>>(
export function setMakeMove(
  makeMove: <GS extends GameState, GM extends GameMoves<GS>, K extends MoveName<GS, GM>>(
    move: GameMoveWithOptionalPayload<GS, GM, K>,
    store: Store<UnknownGameType>,
  ) => void,
) {
  _makeMove = (store) => (move) => {
    return makeMove(move, store);
  };
}

// type EmptyObject = Record<string, never>;

// type IsEmpty<T> = [T[keyof T]] extends [never] ? true : false;

// ? Optional<GameMove<GS, GM, K>, "payload">
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function useMakeMove<GS extends GameState, GM extends GameMoves<GS>>(): <
  K extends MoveName<GS, GM>,
>(
  move: [MovePayload<GS, GM, K>[keyof MovePayload<GS, GM, K>]] extends [never]
    ? Optional<GameMove<GS, GM, K>, "payload">
    : GameMove<GS, GM, K>,
) => void {
  if (!_makeMove) {
    throw new Error(
      '"makeMove" not defined by the host. Did you forget to call `setMakeMove`?',
    );
  }
  const store = useContext(storeContext);
  if (store === null) {
    throw new Error(
      "Store is not defined, did you forget <storeContext.Provider>?",
    );
  }
  return _makeMove(store);
}

/*
 * Deprecated, use `useMakeMove` directly without any hooks.
 */
/// FIXME PUT BACK
// export function useDispatch(): (move: Move) => void {
//   return useMakeMove();
// }

export function makeUseMakeMove<
  GS extends GameState,
  GM extends GameMoves<GS>,
  // K extends MoveName<GS, GM>,
>() {
  return useMakeMove<GS, GM>;
}

/*
 * Main way to get data from the match state.
 */
export function useSelector<GS extends GameState, T>(
  selector: Selector<GS, T>,
): T {
  const store = useContext(storeContext);
  if (store === null) {
    throw new Error("Store is `null`, did you forget <storeContext.Provider>?");
  }
  return _useStore(store as Store<GS>, selector);
}

/* Util to "curry" the types of useSelector<...> */
export const makeUseSelector =
  <GS extends GameState>() =>
  <T,>(selector: Selector<GS, T>) =>
    useSelector<GS, T>(selector);

/* Util to "curry" the types of useSelectorShallow<...> */
export const makeUseSelectorShallow =
  <GS extends GameState>() =>
  <T,>(selector: Selector<GS, T>) =>
    useSelectorShallow<GS, T>(selector);

/*
 * Same as `useSelector` but will use a shallow equal on the output to decide if a render
 * is required or not.
 */
export function useSelectorShallow<GS extends GameState, T>(
  selector: Selector<GS, T>,
): T {
  return useSelector(useShallow(selector));
}

/*
 * Util to check if the user is a player (if not they are a spectator).
 */
export const useIsPlayer = <GS extends GameState>() => {
  // Currently, the user is a player iif its playerboard is defined.
  const hasPlayerboard = useSelector(
    (state: _MatchState<GS["B"], GS["PB"]>) => {
      return !!state.playerboard;
    },
  );
  return hasPlayerboard;
};

type TimeAdjust = "none" | "after" | "before";

const toClientTime =
  (delta: number, latency: number) =>
  (tsNumOrDate: number | Date, adjust: TimeAdjust = "none"): number => {
    let ts: number;
    if (typeof tsNumOrDate !== "number") {
      ts = tsNumOrDate.getTime();
    } else {
      ts = tsNumOrDate;
    }
    ts = ts + delta;

    switch (adjust) {
      case "none":
        return ts;
      case "before":
        return ts - latency;
      case "after":
        return ts + latency;
    }
  };

/*
 * Get a function to convert server times into client times.
 *
 * The returned function takes two argument:
 * ts: the server timestamp to convert.
 * adjust: take the latency into account.
 *  'none': do not adjust (default)
 *  'before': Remove the latency between server and client. This is useful if you want
 *  the player to be able to actually make a move where the is a time limit. In that
 *  case, you want the move to get to the server before the timestamp has past, so we
 *  need to take into account the time for the move to get to the server.
 *  'after': This is the time at which we will receive news from the server that some ts
 *  has happened. This can be useful if you want some action from the server to happen
 *  exactly when a countdown gets to 0.
 */
export const useToClientTime = <GS extends GameState>() => {
  const delta = useSelector(
    (state: _MatchState<GS["B"], GS["PB"]>) => state.timeDelta || 0,
  );
  const latency = useSelector(
    (state: _MatchState<GS["B"], GS["PB"]>) => state.timeLatency || 0,
  );

  return toClientTime(delta, latency);
};

/*
 * Similar to `useToClientTime` but calls the returned function once without any state
 * watching. This is useful when we are already updating some state at regular intervals.
 */
/*
 
 If we want to be able to use this, we'll need a way to set the store outside of the
 Context, which require using a hook.

export function getClientTime(
  tsNumOrDate: Date | number,
  adjust: TimeAdjust,
): number {
  const delta = _store.getState().timeDelta || 0;
  const latency = _store.getState().timeLatency || 0;
  return toClientTime(delta, latency)(tsNumOrDate, adjust);
}
*/

/*
 * Util to play a sound
 */
export const playSound = (name: string) => {
  window.top?.postMessage(
    {
      type: "action",
      payload: { action: { type: "website/playSound", payload: { name } } },
    },
    window.location.origin,
  );
};

/*
 * Util to get a username given its userId
 */
export const useUsername = <GS extends GameState>(
  userId?: UserId,
): string | undefined => {
  const username = useSelector((state: _MatchState<GS["B"], GS["PB"]>) => {
    return userId ? state.users.byId[userId]?.username : undefined;
  });
  return username;
};

/*
 * Return a userId: username mapping.
 */
export const useUsernames = <GS extends GameState>(): Record<
  UserId,
  string
> => {
  // Note the shallow-compared selector.
  const usernames = useSelectorShallow(
    (state: _MatchState<GS["B"], GS["PB"]>) => {
      const users = state.users.byId;
      const usernames: { [userId: string]: string } = {};
      for (const [userId, { username }] of Object.entries(users)) {
        usernames[userId] = username;
      }
      return usernames;
    },
  );

  return usernames;
};

/*
 * Get the userId of the current user.
 */
export const useMyUserId = () => {
  return useSelector((state) => state.userId);
};
