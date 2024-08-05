// We import the CSS here so that rollup picks it up.
import "./index.css";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import classNames from "classnames";
import { applyPatches, Draft, enablePatches, Patch, produce } from "immer";
import { JsonEditor } from "json-edit-react";
import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createStore as _createStore } from "zustand";

import type { Locale, MatchSettings, UserId, UsersState } from "@lefun/core";
import { Game, MoveSideEffects } from "@lefun/game";
import { setMakeMove, Store, storeContext } from "@lefun/ui";

import {
  loadMatchFromLocalStorage,
  Match,
  saveMatchToLocalStorage,
} from "./match";
import { createStore, MainStoreContext, useStore } from "./store";

const LATENCY = 100;

enablePatches();

type MatchState = {
  board: unknown;
  playerboard: unknown;
  userId: UserId;
  users: UsersState;
};

const BoardForPlayer = ({
  board,
  match,
  userId,
  messages,
  locale,
}: {
  board: any;
  match: Match;
  userId: UserId | "spectator";
  messages: Record<string, string>;
  locale: Locale;
}) => {
  useEffect(() => {
    i18n.loadAndActivate({ locale, messages });
  }, [locale, messages]);

  const [loading, setLoading] = useState(true);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    const { players } = match;
    const { store: mainStore } = match;
    const { board, playerboards } = mainStore.getState();

    // We create a local store with the player's boards.
    // We'll update this local store when we receive updates from the "main" match.
    const store = _createStore(() => ({
      userId,
      board: deepCopy(board),
      playerboard:
        userId === "spectator" ? undefined : deepCopy(playerboards[userId]),
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
        store.setState((state: MatchState) => {
          const newState = produce(state, (draft) => {
            applyPatches(draft, patches);
          });
          return newState;
        });
      }, LATENCY);
    });

    setMakeMove((store) => (moveName, payload) => {
      if (userId === "spectator") {
        return;
      }
      const { canDo, executeNow } = match.game.playerMoves[moveName];

      {
        const now = new Date().getTime();
        const { board, playerboard } = store.getState();

        if (canDo) {
          const canTheyDo = canDo({
            userId,
            board,
            playerboard,
            payload,
            ts: now,
          });
          if (!canTheyDo) {
            console.warn(`user ${userId} cannot do move ${name}`);
            return;
          }
        }
      }

      const sideEffects: MoveSideEffects = {
        delayMove() {
          console.warn("delayMove not implemented yet");
          return { ts: 0 };
        },
        endMatch() {
          //
        },
        logPlayerStat() {
          //
        },
        logMatchStat() {
          //
        },
        turns: {
          begin() {
            console.warn("turns.begin not implemented");
            return { expiresAt: 0 };
          },
          end() {
            //
          },
        },
      };

      if (executeNow) {
        // Optimistic update directly on the `store` of the player making the move.
        store.setState((state: MatchState) => {
          const newState = produce(state, (draft: Draft<MatchState>) => {
            const { board, playerboard } = draft;
            executeNow({
              userId,
              board,
              playerboard,
              payload,
              _: sideEffects,
              ...sideEffects,
            });
          });
          return newState;
        });
      }

      match.makeMove(userId, moveName, payload);
      saveMatchToLocalStorage(match, match.gameId);
    });

    storeRef.current = store;
    setLoading(false);
  }, [userId, match]);

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

function MatchStateView() {
  const state = useStore((state) =>
    deepCopy(state.match?.store.getState() || {}),
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
        active ? "bg-neutral-600 text-white" : "bg-neutral-200 text-black",
        disabled
          ? "opacity-50"
          : active
            ? "hover:bg-neutral-700"
            : "hover:bg-neutral-300",
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

function Settings() {
  const setLayout = useStore((state) => state.setLayout);
  const toggleCollapsed = useStore((state) => state.toggleCollapsed);
  const toggleShowDimensions = useStore((state) => state.toggleShowDimensions);
  const layout = useStore((state) => state.layout);
  const collapsed = useStore((state) => state.collapsed);
  const locales = useStore((state) => state.locales);
  const locale = useStore((state) => state.locale);
  const setLocale = useStore((state) => state.setLocale);
  const setVisibleUserId = useStore((state) => state.setVisibleUserId);
  const showDim = useStore((state) => state.showDimensions);
  const visibleUserId = useStore((state) => state.visibleUserId);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const match = useStore((state) => state.match);
  const resetMatch = useStore((state) => state.resetMatch);

  if (!match) {
    return null;
  }

  const { players } = match;

  const userIds = Object.keys(players);
  const numPlayers = userIds.length;

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
              <Button
                onClick={() => setVisibleUserId("spectator")}
                active={visibleUserId === "spectator"}
              >
                Spec
              </Button>
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
                  resetMatch({ locale });
                }}
              >
                Reset Game State
              </Button>
            </ButtonRow>
            <ButtonRow>
              <Button
                onClick={() => {
                  resetMatch({ numPlayers: numPlayers + 1, locale });
                }}
                disabled={numPlayers >= match.game.maxPlayers}
              >
                Add Player
              </Button>
              <Button
                onClick={() => {
                  resetMatch({ numPlayers: numPlayers - 1, locale });
                }}
                disabled={numPlayers <= match.game.minPlayers}
              >
                Remove Player
              </Button>
            </ButtonRow>
          </>
        )}
      </div>
      {view === "game" && <MatchStateView />}
    </div>
  );
}

function PlayerIframe({ userId }: { userId: UserId }) {
  const locale = useStore((state) => state.locale);
  const ref = useRef<HTMLDivElement>(null);
  const { href } = window.location;

  // Force reloading the iframe when the component is rendered.
  const key = Math.random();

  return (
    <>
      <div
        className="border border-black w-full flex-1 h-0 overflow-hidden relative z-0"
        key={userId}
        ref={ref}
      >
        <iframe
          className="z-0 absolute w-full h-full left-0 top-0"
          src={`${href}?u=${userId}&l=${locale}`}
          key={key}
        ></iframe>
        <Dimensions componentRef={ref} />
      </div>
    </>
  );
}

function PlayersIframes() {
  const visibleUserId = useStore((state) => state.visibleUserId);
  const players = useStore((state) => state.match?.players || {});
  const userIds = Object.keys(players);
  userIds.push("spectator");

  return (
    <>
      {userIds.map((userId) => {
        if (visibleUserId === "all" || visibleUserId === userId) {
          return (
            <div className="w-full h-full flex flex-col" key={userId}>
              {userId === "spectator" && (
                <div className="bg-neutral-200 text-center text-sm">
                  Spectator
                </div>
              )}
              <PlayerIframe userId={userId} />
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

type Lefun = {
  match: Match;
};

function Main() {
  const view = useStore((state) => state.view);
  const layout = useStore((state) => state.layout);
  const visibleUserId = useStore((state) => state.visibleUserId);
  const match = useStore((state) => state.match);

  if (!match) {
    return null;
  }

  if (!visibleUserId) {
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
      <Settings />
    </div>
  );
}

type AllMessages = Record<string, Record<string, string>>;

const initMatch = ({
  game,
  matchData,
  gameData,
  matchSettings,
  locale,
  numPlayers,
  tryToLoadFromLocaleStorage = false,
  gameId,
}: {
  game: Game<any, any>;
  matchData: unknown;
  gameData: unknown;
  matchSettings: MatchSettings;
  locale: Locale;
  numPlayers: number;
  tryToLoadFromLocaleStorage?: boolean;
  gameId?: string;
}) => {
  let match: Match | null = null;

  if (tryToLoadFromLocaleStorage) {
    match = loadMatchFromLocalStorage(game, gameId);
  }

  if (match === null) {
    const userIds = getUserIds(numPlayers);

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

    // A different color per player.
    // TODO This is game specific!
    const matchPlayersSettings = Object.fromEntries(
      userIds.map((userId, i) => [userId, { color: i.toString() }]),
    );

    match = new Match({
      game,
      matchSettings,
      matchPlayersSettings,
      matchData,
      gameData,
      players,
      locale,
      gameId,
    });
  }

  return match;
};

async function render({
  game,
  board,
  rules,
  matchSettings = {},
  matchData,
  gameData,
  idName = "home",
  messages = { en: {} },
  gameId = undefined,
}: {
  game: Game<any, any>;
  board: () => Promise<ReactNode>;
  rules?: () => Promise<ReactNode>;
  matchSettings?: MatchSettings;
  matchData?: any;
  gameData?: any;
  idName?: string;
  messages?: AllMessages;
  gameId?: string;
}) {
  function renderComponent(content: ReactNode) {
    const container = document.getElementById(idName);
    const root = createRoot(container!);
    return root.render(content);
  }

  const urlParams = new URLSearchParams(window.location.search);
  let locale = urlParams.get("l") as Locale;
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
    const match = ((window.top as any).lefun as Lefun).match;
    const content = (
      <BoardForPlayer
        match={match}
        board={await board()}
        userId={userId}
        messages={messages[locale]}
        locale={locale}
      />
    );

    return renderComponent(content);
  }

  // If we are here it's because we want to return the <Main> host.

  // Setup our local state store. It will try to load some variables from local
  // storage.
  const locales = (Object.keys(messages) || ["en"]) as Locale[];
  const store = createStore({
    locales,
  });

  // sanity check
  if (locale) {
    throw new Error("locale should not be defined at this point");
  }

  locale = store.getState().locale;

  const resetMatch = ({
    tryToLoadFromLocaleStorage = false,
    numPlayers,
    locale,
  }: {
    tryToLoadFromLocaleStorage?: boolean;
    numPlayers?: number;
    locale?: Locale;
  }) => {
    {
      const match = store.getState().match;
      numPlayers ??=
        Object.keys(match?.players || {}).length || game.minPlayers;
    }

    locale ??= store.getState().locale;
    const match = initMatch({
      game,
      matchData,
      gameData,
      matchSettings,
      locale,
      numPlayers,
      tryToLoadFromLocaleStorage,
      gameId,
    });

    // We use `window.lefun` to communicate between the host and the player boards.
    (window as any).lefun = { match };

    saveMatchToLocalStorage(match, gameId);

    store.setState(() => ({ match }));
  };

  store.setState(() => ({ resetMatch }));

  resetMatch({
    tryToLoadFromLocaleStorage: true,
    locale,
    numPlayers: game.minPlayers,
  });

  // We import the CSS using the package name because this is what will be needed by packages importing this.
  // @ts-expect-error Make typescript happy.
  await import("@lefun/dev-server/index.css");
  let content = <Main />;

  content = (
    <MainStoreContext.Provider value={store}>
      {content}
    </MainStoreContext.Provider>
  );

  return renderComponent(content);
}

export { render };
