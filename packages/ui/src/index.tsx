import { createContext, useContext } from "react";
import { StoreApi, useStore as _useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { MatchState as _MatchState, Move, UserId } from "@lefun/core";

type EmptyObject = Record<string, never>;

// In the selectors, assume that the boards are defined. We will add a check in the
// client code to make sure this is true.
export type MatchState<B, PB = EmptyObject> = _MatchState<B, PB> & {
  userId: UserId;
  board: B;
  playerboard: PB;
};

export type Selector<T, B, PB = EmptyObject> = (state: MatchState<B, PB>) => T;

// TODO Type this properly
export type Store<B = unknown, PB = unknown> = StoreApi<MatchState<B, PB>>;

export const storeContext = createContext<Store | null>(null);

let _makeMove: (store: Store) => (move: Move) => void;

export function setMakeMove(makeMove: (move: Move, store: Store) => void) {
  _makeMove = (store) => (move) => {
    return makeMove(move, store);
  };
}

export function useMakeMove(): (move: Move) => void {
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
export function useDispatch(): (move: Move) => void {
  return useMakeMove();
}

/*
 * Main way to get data from the match state.
 */
export function useSelector<T, B, PB>(selector: Selector<T, B, PB>): T {
  const store = useContext(storeContext);
  if (store === null) {
    throw new Error("Store is `null`, did you forget <storeContext.Provider>?");
  }
  return _useStore(store as Store<B, PB>, selector);
}

/* Util to "curry" the types of useSelector<...> */
export const makeUseSelector =
  <B, PB = EmptyObject>() =>
  <T,>(selector: Selector<T, B, PB>) =>
    useSelector<T, B, PB>(selector);

/* Util to "curry" the types of useSelectorShallow<...> */
export const makeUseSelectorShallow =
  <B, PB = EmptyObject>() =>
  <T,>(selector: Selector<T, B, PB>) =>
    useSelectorShallow<T, B, PB>(selector);

/*
 * Same as `useSelector` but will use a shallow equal on the output to decide if a render
 * is required or not.
 */
export function useSelectorShallow<T, B = unknown, PB = unknown>(
  selector: Selector<T, B, PB>,
): T {
  return useSelector(useShallow(selector));
}

/*
 * Util to check if the user is a player (if not they are a spectator).
 */
export const useIsPlayer = <B, PB>() => {
  // Currently, the user is a player iif its playerboard is defined.
  const hasPlayerboard = useSelector((state: _MatchState<B, PB>) => {
    return !!state.playerboard;
  });
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
export const useToClientTime = <B, PB>() => {
  const delta = useSelector(
    (state: _MatchState<B, PB>) => state.timeDelta || 0,
  );
  const latency = useSelector(
    (state: _MatchState<B, PB>) => state.timeLatency || 0,
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
export const useUsername = <B, PB>(userId?: UserId): string | undefined => {
  const username = useSelector((state: _MatchState<B, PB>) => {
    return userId ? state.users.byId[userId]?.username : undefined;
  });
  return username;
};

/*
 * Return a userId: username mapping.
 */
export const useUsernames = <B, PB>(): Record<UserId, string> => {
  // Note the shallow-compared selector.
  const usernames = useSelectorShallow((state: _MatchState<B, PB>) => {
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
