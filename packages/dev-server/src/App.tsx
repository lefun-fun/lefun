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
import { createRoot } from "react-dom/client";
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
  messages,
  locale,
}: {
  board: any;
  userId: UserId;
  messages: Record<string, string>;
  locale: Locale;
}) => {
  useEffect(() => {
    i18n.loadAndActivate({ locale, messages });
  }, [locale, messages]);

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
                console.warn("delayMove not implemented yet");
                return { ts: 0 };
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

function RulesWrapper({
  children,
  messages,
  locale,
}: {
  children: ReactNode;
  messages: Record<string, string>;
  locale: Locale;
}) {
  useEffect(() => {
    i18n.loadAndActivate({ locale, messages });
  }, [locale, messages]);

  return (
    <I18nProvider i18n={i18n}>
      <div style={{ height: "100%", width: "100%" }}>{children}</div>
    </I18nProvider>
  );
}

function getUserIds(numPlayers: number) {
  return Array(numPlayers)
    .fill(null)
    .map((_, i) => i.toString());
}

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

const Button = ({
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) => {
  return (
    <button
      onClick={() => onClick && onClick()}
      className={classNames(
        "p-1 border border-neutral-500 rounded-sm",
        "min-w-10",
        active
          ? "bg-neutral-600 text-white hover:bg-neutral-700"
          : "bg-neutral-200 text-black hover:bg-neutral-300",
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex space-x-1">{children}</div>;
}

function capitalize(s: string): string {
  return s && s[0].toUpperCase() + s.slice(1);
}

function Settings<B, PB, SB>({
  matchRef,
  resetMatch,
}: {
  matchRef: RefObject<Match<B, PB, SB>>;
  resetMatch: ({
    locale,
    numPlayers,
  }: {
    locale: Locale;
    numPlayers: number;
  }) => void;
}) {
  const setLayout = useStore((state) => state.setLayout);
  const toggleCollapsed = useStore((state) => state.toggleCollapsed);
  const toggleShowDimensions = useStore((state) => state.toggleShowDimensions);
  const layout = useStore((state) => state.layout);
  const collapsed = useStore((state) => state.collapsed);
  const numPlayers = useStore((state) => state.numPlayers);
  const setNumPlayers = useStore((state) => state.setNumPlayers);
  const locales = useStore((state) => state.locales);
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);
  const setVisibleUserId = useStore((state) => state.setVisibleUserId);
  const showDim = useStore((state) => state.showDimensions);
  const visibleUserId = useStore((state) => state.visibleUserId);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);

  const userIds = getUserIds(numPlayers);

  if (collapsed) {
    return (
      <div className="absolute right-0 top-0">
        <Button onClick={toggleCollapsed}>◀</Button>
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
          <Button onClick={toggleCollapsed}>▶</Button>
        </ButtonRow>
        <ButtonRow>
          {(["game", "rules"] as const).map((v) => (
            <Button key={v} active={v === view} onClick={() => setView(v)}>
              {capitalize(v)}
            </Button>
          ))}
        </ButtonRow>
        <ButtonRow>
          <Button onClick={() => toggleShowDimensions()} active={showDim}>
            ? x ?
          </Button>
          {locales.map((otherLocale) => (
            <Button
              key={otherLocale}
              onClick={() => setLocale(otherLocale)}
              active={otherLocale === locale}
            >
              {otherLocale}
            </Button>
          ))}
        </ButtonRow>
        {view === "game" && (
          <>
            <ButtonRow>
              {userIds.map((userId) => (
                <Button
                  key={userId}
                  onClick={() => setVisibleUserId(userId)}
                  active={visibleUserId === userId}
                >
                  {userId}
                </Button>
              ))}
              <Button
                onClick={() => {
                  setVisibleUserId("all");
                  setLayout("row");
                }}
                active={visibleUserId === "all" && layout === "row"}
              >
                ||
              </Button>
              <Button
                onClick={() => {
                  setVisibleUserId("all");
                  setLayout("column");
                }}
                active={visibleUserId === "all" && layout === "column"}
              >
                =
              </Button>
            </ButtonRow>
            <ButtonRow>
              <Button
                onClick={() => {
                  resetMatch({ numPlayers, locale });
                  window.location.reload();
                }}
              >
                Reset Game State
              </Button>
            </ButtonRow>
            <ButtonRow>
              <Button
                onClick={() => {
                  const newNumPlayers = numPlayers + 1;
                  setNumPlayers(newNumPlayers);
                  resetMatch({ numPlayers: newNumPlayers, locale });
                  window.location.reload();
                }}
              >
                Add Player
              </Button>
              <Button
                onClick={() => {
                  const newNumPlayers = numPlayers - 1;
                  setNumPlayers(newNumPlayers);
                  resetMatch({ numPlayers: newNumPlayers, locale });
                  window.location.reload();
                }}
              >
                Remove Player
              </Button>
            </ButtonRow>
          </>
        )}
      </div>
      <MatchStateView<B, PB, SB> matchRef={matchRef} />
    </div>
  );
}

function PlayersIframes() {
  const numPlayers = useStore((state) => state.numPlayers);
  const visibleUserId = useStore((state) => state.visibleUserId);
  const locale = useStore((state) => state.locale);

  const ref = useRef<HTMLDivElement>(null);

  return (
    <>
      {getUserIds(numPlayers).map((userId) => {
        if (visibleUserId === "all" || visibleUserId === userId) {
          const { href } = window.location;
          return (
            <div
              className="border border-black w-full h-full overflow-hidden relative z-0"
              key={userId}
              ref={ref}
            >
              <iframe
                className="z-0 absolute w-full h-full left-0 top-0"
                src={`${href}?u=${userId}&l=${locale}`}
              ></iframe>
              <Dimensions componentRef={ref} />
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function RulesIframe() {
  const locale = useStore((state) => state.locale);
  const { href } = window.location;

  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="border border-black w-full h-full overflow-hidden relative z-0"
      ref={ref}
    >
      <iframe
        className="z-0 absolute w-full h-full left-0 top-0"
        src={`${href}?v=rules&l=${locale}`}
      ></iframe>
      <Dimensions componentRef={ref} />
    </div>
  );
}

function Dimensions({
  componentRef,
}: {
  componentRef: RefObject<HTMLDivElement>;
}) {
  const showDim = useStore((state) => state.showDimensions);

  const { width, height } = useSetDimensionCssVariablesOnResize(componentRef);

  if (!showDim) {
    return null;
  }
  return (
    <div className="z-10 absolute top-0 right-0 bg-black bg-opacity-10 px-1">
      {Math.round(width)} x {Math.round(height)}
    </div>
  );
}

function Main<B, PB = EmptyObject, SB = EmptyObject>({
  gameDef,
  matchSettings,
  matchData,
  gameData,
}: {
  gameDef: GameDef<B, PB, SB>;
  matchSettings: MatchSettings;
  matchData?: any;
  gameData?: any;
}) {
  const view = useStore((state) => state.view);
  const locale = useStore((state) => state.locale);
  const layout = useStore((state) => state.layout);
  const visibleUserId = useStore((state) => state.visibleUserId);
  const numPlayers = useStore((state) => state.numPlayers);

  const [loading, setLoading] = useState(true);

  const matchRef = useRef<Match<B, PB, SB> | null>(null);

  const resetMatch = useCallback(
    ({
      locale,
      numPlayers,
      tryToLoad = false,
    }: {
      locale: Locale;
      numPlayers: number;
      tryToLoad?: boolean;
    }) => {
      const userIds = getUserIds(numPlayers);

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
          gameData,
          players,
          locale,
        });
      }

      matchRef.current = match;
      (window as any).lefun.match = matchRef.current;
      saveMatch(match);
    },
    [gameDef, matchData, gameData, matchSettings],
  );

  const firstRender = useRef(true);

  // Call the `resetMatch` callback the first time we render.
  useEffect(() => {
    if (!firstRender.current) {
      return;
    }
    resetMatch({ tryToLoad: true, locale, numPlayers });
    firstRender.current = false;
    setLoading(false);
  }, [resetMatch, locale, numPlayers]);

  if (loading || !visibleUserId) {
    return <div>Loading</div>;
  }

  return (
    <div className="h-full w-full relative flex">
      <div
        className={classNames(
          "w-0 flex-1 relative flex",
          layout === "row" ? "flex-row" : "flex-col",
        )}
      >
        {view === "rules" ? <RulesIframe /> : <PlayersIframes />}
      </div>
      {matchRef && (
        <Settings<B, PB, SB>
          matchRef={matchRef}
          resetMatch={({
            numPlayers,
            locale,
          }: {
            numPlayers: number;
            locale: Locale;
          }) => resetMatch({ tryToLoad: false, numPlayers, locale })}
        />
      )}
    </div>
  );
}

type AllMessages = Record<string, Record<string, string>>;

async function render<B, PB = EmptyObject, SB = EmptyObject>({
  gameDef,
  board,
  rules,
  matchSettings = {},
  matchData,
  gameData,
  idName = "home",
  messages = { en: {} },
}: {
  gameDef: GameDef<B, PB, SB>;
  board: () => Promise<ReactNode>;
  rules?: () => Promise<ReactNode>;
  matchSettings?: MatchSettings;
  matchData?: any;
  gameData?: any;
  idName?: string;
  messages?: AllMessages;
}) {
  function renderComponent(content: ReactNode) {
    const container = document.getElementById(idName);
    const root = createRoot(container!);
    return root.render(content);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const locale = urlParams.get("l") as Locale;
  const isRules = urlParams.get("v") === "rules";

  if (isRules) {
    if (!rules) {
      return renderComponent(<div>Rules not defined</div>);
    }
    return renderComponent(
      <RulesWrapper messages={messages[locale]} locale={locale}>
        {await rules()}
      </RulesWrapper>,
    );
  }

  const userId = urlParams.get("u");

  // Is it the player's board?
  if (userId !== null) {
    const content = (
      <BoardForPlayer
        board={await board()}
        userId={userId}
        messages={messages[locale]}
        locale={locale}
      />
    );

    return renderComponent(content);
  }

  // If we are here it's because we want to return the <Main> host.

  // We use `window.lefun` to communicate between the host and the player boards.
  (window as any).lefun = {};

  // We import the CSS using the package name because this is what will be needed by packages importing this.
  // @ts-expect-error Make typescript happy.
  await import("@lefun/dev-server/index.css");
  const locales = (Object.keys(messages) || ["en"]) as Locale[];
  let content = (
    <Main
      gameDef={gameDef}
      matchSettings={matchSettings}
      matchData={matchData}
      gameData={gameData}
    />
  );

  const store = createStore({
    numPlayers: gameDef.minPlayers,
    locales,
  });

  content = (
    <MainStoreContext.Provider value={store}>
      {content}
    </MainStoreContext.Provider>
  );

  return renderComponent(content);
}

export { render };
