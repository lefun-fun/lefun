import { useMemo } from "react";

import type { IfAnyNull, MatchState as _MatchState, UserId } from "@lefun/core";
import type { Game, GameStateBase, GetPayload } from "@lefun/game";

// In the selectors, assume that the boards are defined. We will add a check in the
// client code to make sure this is true.
export type MatchState<GS extends GameStateBase = GameStateBase> = _MatchState<
  GS["B"],
  GS["PB"]
> & {
  userId: UserId;
  board: GS["B"];
  // We need this to be optional because of spectators.
  playerboard?: GS["PB"];
};

export type Selector<GS extends GameStateBase, T> = (
  state: MatchState<GS>,
) => T;

export type MakeMove<G extends Game> = <
  K extends keyof G["playerMoves"] & string,
>(
  moveName: K,
  ...payload: IfAnyNull<
    GetPayload<G, K>,
    // any
    [] | [any],
    // null
    [],
    // other
    [GetPayload<G, K>]
  >
) => void;

type MakeMoveFull<G extends Game> = <K extends keyof G["playerMoves"] & string>(
  moveName: K,
  payload: GetPayload<G, K>,
) => void;

let _makeMove: MakeMoveFull<Game> | null = null;

export function setMakeMove(makeMove: MakeMoveFull<Game>) {
  _makeMove = makeMove;
}

export type UseSelector = <GS extends GameStateBase, T>(
  selector: Selector<GS, T>,
) => T;

let _useSelector: UseSelector | null = null;
let _useSelectorShallow: UseSelector | null = null;

export function setUseSelector(arg0: () => UseSelector) {
  _useSelector = arg0();
}

export function setUseSelectorShallow(arg0: () => UseSelector) {
  _useSelectorShallow = arg0();
}

/*
 * Main way to get data from the match state.
 */
export function useSelector<GS extends GameStateBase, T>(
  selector: Selector<GS, T>,
): T {
  if (_useSelector === null) {
    throw new Error(
      `"useSelector" not defined by the host. Did you forget to call \`setUseSelector\`?`,
    );
  }
  return _useSelector(selector);
}

export function useSelectorShallow<GS extends GameStateBase, T>(
  selector: Selector<GS, T>,
): T {
  if (_useSelectorShallow === null) {
    throw new Error(
      `"useShallowSelector" not defined by the host. Did you forget to call \`setUseShallowSelector\`?`,
    );
  }
  return _useSelectorShallow(selector);
}

/* Util to "curry" the types of useSelector<...> */
export const makeUseSelector =
  <GS extends GameStateBase>() =>
  <T>(selector: Selector<GS, T>) =>
    useSelector<GS, T>(selector);

export const makeUseSelectorShallow =
  <GS extends GameStateBase>() =>
  <T>(selector: Selector<GS, T>) =>
    useSelectorShallow<GS, T>(selector);

export function useMakeMove<G extends Game = Game>(): MakeMove<G> {
  if (!_makeMove) {
    throw new Error(
      '"makeMove" not defined by the host. Did you forget to call `setMakeMove`?',
    );
  }
  // `_makeMove` returns a new function every time it's called, but we don't want to
  // re-render.
  return useMemo(() => {
    function newMakeMove<K extends keyof G["playerMoves"] & string>(
      moveName: K,
      ...payload: IfAnyNull<
        GetPayload<G, K>,
        [] | [any],
        [],
        [GetPayload<G, K>]
      >
    ) {
      if (!_makeMove) {
        throw new Error(
          '"makeMove" not defined by the host. Did you forget to call `setMakeMove`?',
        );
      }
      return _makeMove(moveName, payload[0] || null);
    }

    return newMakeMove;
  }, []);
}

export function makeUseMakeMove<G extends Game>() {
  return useMakeMove<G>;
}

/*
 * Util to check if the user is a player (if not they are a spectator).
 */
export const useIsPlayer = <GS extends GameStateBase>() => {
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
  (tsNumOrDate: number | Date, adjust: TimeAdjust = "before"): number => {
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
export const useToClientTime = <GS extends GameStateBase>() => {
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
export const useUsername = <GS extends GameStateBase>(
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
export const useUsernames = (): Record<UserId, string> => {
  // Note the shallow-compared selector.
  const usernames = useSelectorShallow((state: _MatchState) => {
    const users = state.users.byId;
    const usernames: { [userId: string]: string } = {};
    for (const [userId, { username }] of Object.entries(users)) {
      usernames[userId] = username;
    }
    return usernames;
  });

  return usernames;
};

/*
 * Get the userId of the current user.
 */
export const useMyUserId = () => {
  return useSelector((state) => state.userId);
};

// This has an awkward API for backward compatibility reasons.
export type _Store<GS extends GameStateBase> = {
  getState(): MatchState<GS>;
};

export type UseStore<GS extends GameStateBase = GameStateBase> = _Store<GS>;

let _useStore: UseStore | null = null;

export const setUseStore = (arg0: () => MatchState) => {
  _useStore = {
    getState() {
      return arg0();
    },
  };
};

/* Return the store object.
 *
 * This is useful to access the state without subscribing to changes:
 * ```
 * const store = useStore()
 * const x = store.getState().board.x
 * ```
 * */
export function useStore<
  GS extends GameStateBase = GameStateBase,
>(): _Store<GS> {
  if (_useStore === null) {
    throw new Error(
      '"useStore" not defined by the host. Did you forget to call `setUseStore`?',
    );
  }
  return _useStore;
}

/* Convenience function to get a typed `useStore` hook. */
export const makeUseStore = <GS extends GameStateBase>() => useStore<GS>;
