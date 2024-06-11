// We import the CSS here so that rollup picks it up.
import "./index.css";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import classNames from "classnames";
import { applyPatches, Draft, enablePatches, Patch, produce } from "immer";
import { JsonEditor } from "json-edit-react";
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { render as render_ } from "react-dom";
import { createStore as _createStore, useStore as _useStore } from "zustand";

import type { Locale, MatchSettings, UserId, UsersState } from "@lefun/core";
import { GameDef } from "@lefun/game";
import { setMakeMove, Store, storeContext } from "@lefun/ui";

import { loadMatch, Match, saveMatch } from "./match";
import { createStore, MainStoreContext, useStore } from "./store";

const LATENCY = 100;

enablePatches();

type MatchState<B, PB> = {
  board: B;
  playerboard: PB;
  userId: UserId;
  users: UsersState;
};

const BoardForPlayer = <B, PB>({
  board,
  userId,
  locale,
  messages,
}: {
  board: any;
  userId: UserId;
  locale: Locale;
  messages: Record<string, string>;
}) => {
  i18n.loadAndActivate({ locale, messages });

  const [loading, setLoading] = useState(true);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    const { lefun } = (window as any).top;
    const { match, players } = lefun;
    const { store: mainStore } = match;
    const { board, playerboards } = mainStore.getState();

    const store = _createStore(() => ({
      userId,
      board: deepCopy(board),
      playerboard: deepCopy(playerboards[userId]),
      users: { byId: deepCopy(players) },
    }));

    match.addEventListener(`move:${userId}`, (event: any) => {
      if (!event) {
        return;
      }

      let patches: Patch[] = [];
      ({ patches } = event.detail);

      // Wait before we apply the updates to simulate a network latency.
      setTimeout(() => {
        store.setState((state: MatchState<B, PB>) => {
          const newState = produce(state, (draft) => {
            applyPatches(draft, patches);
          });
          return newState;
        });
      }, LATENCY);
    });

    setMakeMove((move, store) => {
      const { canDo, executeNow } = match.gameDef.moves[move.name];

      const { payload } = move;

      {
        const now = new Date().getTime();
        const { board, playerboard } = store.getState();

        if (canDo) {
          const canTheyDo = canDo({
            userId,
            board,
            playerboard,
            payload: move.payload,
            ts: now,
          });
          if (!canTheyDo) {
            console.warn(`user ${userId} cannot do move ${name}`);
            return;
          }
        }
      }

      if (executeNow) {
        // Optimistic update directly on the `store` of the player making the move.
        store.setState((state: MatchState<B, PB>) => {
          const newState = produce(state, (draft: Draft<MatchState<B, PB>>) => {
            const { board, playerboard } = draft;
            executeNow({
              userId,
              board: board as B,
              playerboard: playerboard as PB,
              payload,
              delayMove: () => {
                throw new Error("delayMove not implemented yet");
              },
            });
          });
          return newState;
        });
      }

      match.makeMove(userId, move);
      saveMatch(match);
    });

    storeRef.current = store;
    setLoading(false);
  }, [userId]);

  if (loading) {
    return <div>Loading player...</div>;
  }

  return (
    <I18nProvider i18n={i18n}>
      <div style={{ height: "100%", width: "100%" }}>
        <storeContext.Provider value={storeRef.current}>
          {board}
        </storeContext.Provider>
      </div>
    </I18nProvider>
  );
};

/*
 * Deep copy an object.
 */
function deepCopy<T>(obj: T): T {
  if (obj === undefined) {
    return obj;
  }

  return JSON.parse(JSON.stringify(obj));
}

type EmptyObject = Record<string, never>;

function useSetDimensionCssVariablesOnResize(ref: RefObject<HTMLElement>) {
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setWidth(width);
      setHeight(height);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  });

  return { height, width };
}

function MatchStateView<B, PB, SB>({
  matchRef,
}: {
  matchRef: RefObject<Match<B, PB, SB>>;
}) {
  const state = _useStore(matchRef.current?.store as any, (state) =>
    deepCopy(state),
  );

  return (
    <div className="">
      <JsonEditor
        data={state as any}
        collapse={2}
        rootName="state"
        restrictEdit={true}
        restrictDelete={true}
        restrictAdd={true}
      />
    </div>
  );
}

function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex space-x-1">{children}</div>;
}

function Settings<B, PB, SB>({
  visibleUserId,
  onSetVisibleUserId,
  matchRef,
  resetMatch,
}: {
  visibleUserId: UserId;
  onSetVisibleUserId: (userId: UserId) => void;
  matchRef: RefObject<Match<B, PB, SB>>;
  resetMatch: () => void;
}) {
  const toggleLayout = useStore((state) => state.toggleLayout);
  const toggleCollapsed = useStore((state) => state.toggleCollapsed);
  const toggleShowDimensions = useStore((state) => state.toggleShowDimensions);
  const layout = useStore((state) => state.layout);
  const collapsed = useStore((state) => state.collapsed);
  const numPlayers = useStore((state) => state.numPlayers);
  const setNumPlayers = useStore((state) => state.setNumPlayers);

  if (collapsed) {
    return (
      <div className="absolute right-0 top-0">
        <button onClick={toggleCollapsed}>{"<"}</button>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        "flex w-1/4 min-w-60 flex flex-col overflow-y-auto",
      )}
    >
      <div className="flex flex-col gap-1 items-start justify-start">
        <ButtonRow>
          <button onClick={toggleCollapsed}>{collapsed ? "◀" : "▶"}</button>
          <button onClick={() => toggleShowDimensions()}>? x ?</button>
        </ButtonRow>
        <ButtonRow>
          {Array(numPlayers)
            .fill(null)
            .map((_, index) => (
              <button
                key={index}
                onClick={() => onSetVisibleUserId(index.toString())}
              >
                {index}
              </button>
            ))}
          <button> Spectator (Todo)</button>
          <button
            onClick={() => {
              if (visibleUserId !== "all") {
                onSetVisibleUserId("all");
              } else {
                toggleLayout();
              }
            }}
          >
            {layout === "row" ? "||" : "="}
          </button>
        </ButtonRow>
        <ButtonRow>
          <button
            onClick={() => {
              resetMatch();
              window.location.reload();
            }}
          >
            Reset Game State
          </button>
        </ButtonRow>
        <ButtonRow>
          <button
            onClick={() => {
              setNumPlayers(numPlayers + 1);
              window.location.reload();
            }}
          >
            Add Player
          </button>
          <button
            onClick={() => {
              setNumPlayers(numPlayers - 1);
              window.location.reload();
            }}
          >
            Remove Player
          </button>
        </ButtonRow>
      </div>
      <MatchStateView<B, PB, SB> matchRef={matchRef} />
    </div>
  );
}

function Main<B, PB = EmptyObject, SB = EmptyObject>({
  gameDef,
  matchSettings,
  matchData,
}: {
  gameDef: GameDef<B, PB, SB>;
  matchSettings: MatchSettings;
  matchData?: any;
}) {
  const [loading, setLoading] = useState(true);

  const layout = useStore((state) => state.layout);

  const numPlayers = useStore((state) => state.numPlayers);

  const [visibleUserId, setVisibleUserId] = useState<UserId | "all">("all");

  const matchRef = useRef<Match<B, PB, SB> | null>(null);

  const resetMatch = useCallback(
    ({ tryToLoad = true }: { tryToLoad?: boolean } = {}) => {
      const userIds = Array(numPlayers)
        .fill(null)
        .map((_, i) => i.toString());
      let match: Match<B, PB, SB> | null = null;

      if (tryToLoad) {
        match = loadMatch<B, PB, SB>(gameDef);
      }

      const players = Object.fromEntries(
        userIds.map((userId) => [
          userId,
          {
            username: `Player ${userId}`,
            isBot: false,
            // TODO We don't need to know if they are guests in here.
            isGuest: false,
          },
        ]),
      );

      (window as any).lefun.players = players;

      if (match === null) {
        // A different color per player.
        // TODO This is game specific!
        const matchPlayersSettings = Object.fromEntries(
          userIds.map((userId, i) => [userId, { color: i.toString() }]),
        );

        match = new Match<B, PB, SB>({
          gameDef,
          matchSettings,
          matchPlayersSettings,
          matchData,
          players,
          // This is the locale passed to initialBoards.
          locale: "en",
        });
      }

      matchRef.current = match;
      (window as any).lefun.match = matchRef.current;
      saveMatch(match);
    },
    [gameDef, matchData, matchSettings, numPlayers],
  );

  const firstRender = useRef(true);

  useEffect(() => {
    resetMatch({ tryToLoad: firstRender.current });
    firstRender.current = false;
    setLoading(false);
  }, [resetMatch]);

  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useSetDimensionCssVariablesOnResize(ref);

  const showDim = useStore((state) => state.showDimensions);

  if (loading || !visibleUserId) {
    return <div>Loading</div>;
  }

  const userIds = Array(numPlayers)
    .fill(null)
    .map((_, i) => i.toString());

  return (
    <div className="h-full w-full relative flex">
      <div
        className={classNames(
          "w-0 flex-1 relative flex",
          layout === "row" ? "flex-row" : "flex-col",
        )}
      >
        {userIds.map((userId) => {
          if (visibleUserId === "all" || visibleUserId === userId) {
            const { href } = window.location;
            return (
              <div
                className="border border-black w-full h-full overflow-hidden relative z-0"
                key={userId}
                ref={ref}
              >
                {showDim && (
                  <div className="z-10 absolute top-0 right-0 bg-black bg-opacity-10 px-1">
                    {Math.round(width)} x {Math.round(height)}
                  </div>
                )}
                <iframe
                  className="z-0 absolute w-full h-full left-0 top-0"
                  src={`${href}?u=${userId}`}
                ></iframe>
              </div>
            );
          }
          return null;
        })}
      </div>
      {matchRef && (
        <Settings<B, PB, SB>
          visibleUserId={visibleUserId}
          onSetVisibleUserId={setVisibleUserId}
          matchRef={matchRef}
          resetMatch={() => resetMatch({ tryToLoad: false })}
        />
      )}
    </div>
  );
}

async function render<B, PB, SB = EmptyObject>({
  gameDef,
  board,
  matchSettings,
  matchData,
  idName = "home",
  messages = { fr: {}, en: {} },
}: {
  gameDef: GameDef<B, PB, SB>;
  board: () => Promise<ReactNode>;
  matchSettings: MatchSettings;
  matchData?: any;
  idName?: string;
  messages?: Record<string, Record<string, string>>;
}) {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("u");

  function renderComponent(content: ReactNode) {
    const element = document.getElementById(idName);

    // TODO Why `as any`?
    return render_(content as any, element);
  }

  // Is it the player's board?
  if (userId !== null) {
    const locales = Object.keys(messages) as Locale[];
    const locale = locales[0] || "en";

    const content = (
      <BoardForPlayer
        board={await board()}
        userId={userId}
        locale={locale}
        messages={messages[locale]}
      />
    );

    return renderComponent(content);
  }

  // If we are here it's because we want to return the <Main> host.

  // We use `window.lefun` to communicate between the host and the player boards.
  (window as any).lefun = {};

  // We import the CSS using the package name because this is what will be needed by packages importing this.
  // @ts-expect-error to make ts happy
  await import("dev-server/index.css");
  let content = (
    <Main
      gameDef={gameDef}
      matchSettings={matchSettings}
      matchData={matchData}
    />
  );

  const store = createStore({
    numPlayers: gameDef.minPlayers,
  });

  content = (
    <MainStoreContext.Provider value={store}>
      {content}
    </MainStoreContext.Provider>
  );

  return renderComponent(content);
}

export { render };
