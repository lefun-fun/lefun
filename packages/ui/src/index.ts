import { useMemo } from "react";

import type { IfAnyNull, Meta, UserId } from "@lefun/core";
import type {
  Game,
  GameStateAny,
  GameStateBase,
  GetPayload,
} from "@lefun/game";

export type Selector<GS extends GameStateBase, T> = (state: UIState<GS>) => T;

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

export type UseSelector<GS extends GameStateBase> = <T>(
  selector: Selector<GS, T>,
) => T;

let _useSelector: UseSelector<GameStateBase> | null = null;
let _useSelectorShallow: UseSelector<GameStateBase> | null = null;

export function setUseSelector(arg0: () => UseSelector<GameStateBase>) {
  _useSelector = arg0();
}

export function setUseSelectorShallow(arg0: () => UseSelector<GameStateBase>) {
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
  return _useSelector(selector as Selector<GameStateBase, T>);
}

export function useSelectorShallow<GS extends GameStateBase, T>(
  selector: Selector<GS, T>,
): T {
  if (_useSelectorShallow === null) {
    throw new Error(
      `"useShallowSelector" not defined by the host. Did you forget to call \`setUseShallowSelector\`?`,
    );
  }
  return _useSelectorShallow(selector as Selector<GameStateBase, T>);
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

export function useMakeMove<G extends Game<GameStateAny>>(): MakeMove<G> {
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

export function makeUseMakeMove<G extends Game<GameStateAny>>() {
  return useMakeMove<G>;
}

/*
 * Util to check if the user is a player (if not they are a spectator).
 */
export const useIsPlayer = <GS extends GameStateBase>() =>
  useSelector((state: UIState<GS>) => {
    return state.meta.players.byId[state.userId] !== undefined;
  });

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
export const useToClientTime = () => {
  const delta = useSelector(
    (state: UIState<GameStateBase>) => state.timeDelta || 0,
  );
  const latency = useSelector(
    (state: UIState<GameStateBase>) => state.timeLatency || 0,
  );

  return toClientTime(delta, latency);
};

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
  const username = useSelector((state: UIState<GS>) => {
    return userId ? state.users[userId]?.username : undefined;
  });
  return username;
};

/*
 * Return a userId: username mapping.
 */
export const useUsernames = (): Record<UserId, string> => {
  // Note the shallow-compared selector.
  const usernames = useSelectorShallow((state: UIState<GameStateBase>) => {
    const { users } = state;
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
  getState(): UIState<GS>;
};

export type UseStore<GS extends GameStateBase = GameStateBase> = _Store<GS>;

let _useStore: UseStore<any> | null = null;

export const setUseStore = (arg0: () => UIState<GameStateBase>) => {
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

export const useUserTurn = (
  userId?: UserId,
  adjust: TimeAdjust = "before",
):
  | { itsTheirTurn: boolean; beganAt: number; expiresAt: number | undefined }
  // If we have no `beganAt` then there cannot be an `expiresAt`.
  | { itsTheirTurn: boolean; beganAt: undefined; expiresAt: undefined } => {
  let expiresAt = useSelector((state: UIState<GameStateBase>) => {
    return userId ? state.meta.players.byId[userId]?.turnExpiresAt : undefined;
  });
  let beganAt = useSelector((state: UIState<GameStateBase>) => {
    return userId ? state.meta.players.byId[userId]?.turnBeganAt : undefined;
  });

  const toClientTime = useToClientTime();

  if (beganAt === undefined) {
    return {
      itsTheirTurn: !!beganAt,
      beganAt: undefined,
      expiresAt: undefined,
    };
  }

  if (beganAt) {
    beganAt = toClientTime(beganAt, adjust);
  }

  if (expiresAt) {
    expiresAt = toClientTime(expiresAt, adjust);
  }

  return { itsTheirTurn: !!beganAt, beganAt, expiresAt };
};

export type User = { username: string };

export type Users = Record<UserId, User>;

/*
 * State of the match as seen from a player.
 * This is what the game UI has access to.
 * Note that there is a version with less `undefined` values in `@lefun/ui`, for use by
 * game developers.
 */
export type UIState<GS extends GameStateBase = GameStateBase> = {
  // The player's userid
  userId: UserId;

  // The non-match related info required about the human users in the match.
  users: Users;

  board: GS["B"];
  // `playerboard is `null` for spectators.
  // Note that GS['PB'] can itself be `null` for games without playerboards.
  playerboard: GS["PB"] | null;
  meta: Meta;

  // Timing info with respect to the
  timeDelta: number;
  timeLatency: number;
};
