// We import the CSS here so that rollup picks it up.
import "./index.css";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import classNames from "classnames";
import { applyPatches, enablePatches, Patch, produce } from "immer";
import { JsonEditor } from "json-edit-react";
import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { createStore as _createStore } from "zustand";

import {
  GameId,
  GamePlayerSettings_,
  GameSetting,
  GameSettings_,
  Locale,
  UserId,
  UsersState,
} from "@lefun/core";
import { executePlayerMove, MoveExecutionOutput } from "@lefun/game";
import { setMakeMove, Store, storeContext } from "@lefun/ui";

import { Match, saveMatchToLocalStorage } from "./match";
import { useStore } from "./store";

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
  gameId,
}: {
  board: any;
  match: Match;
  userId: UserId | "spectator";
  messages: Record<string, string>;
  locale: Locale;
  gameId: GameId;
}) => {
  useEffect(() => {
    i18n.loadAndActivate({ locale, messages });
  }, [locale, messages]);

  const [loading, setLoading] = useState(true);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    const { store: mainStore } = match;
    const { users } = mainStore;
    const { board, playerboards } = mainStore; //.getState();

    // We create a local store with the player's boards.
    // We'll update this local store when we receive updates from the "main" match.
    const store = _createStore(
      () =>
        ({
          userId,
          board: deepCopy(board),
          playerboard:
            userId === "spectator" ? undefined : deepCopy(playerboards[userId]),
          users,
        }) satisfies MatchState,
    );

    match.addEventListener(`patches:${userId}`, (event: any) => {
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
        throw new Error("spectator cannot make moves");
      }

      if (match.store.matchStatus === "over") {
        console.warn("match is over");
        return;
      }

      // Run the move locally for optimistic UI.
      const { board, playerboard } = store.getState();

      let result: MoveExecutionOutput | null = null;

      try {
        result = executePlayerMove({
          name: moveName,
          payload,
          game: match.game,
          userId,
          board,
          playerboards: { [userId]: playerboard },
          secretboard: null,
          now: new Date().getTime(),
          random: match.random,
          skipCanDo: false,
          onlyExecuteNow: true,
          // Note that technically we should not use anything from
          // `match.store` as this represents the DB.
          matchData: match.store.matchData,
          gameData: match.store.gameData,
          meta: match.store.meta,
        });
      } catch (e) {
        console.warn(
          `Ignoring move "${moveName}" for user "${userId}" because of error`,
        );
        return;
      }

      const { patches } = result;
      store.setState((state: MatchState) => applyPatches(state, patches));

      // Run the move in the backend also.
      match.makeMove(userId, moveName, payload);

      saveMatchToLocalStorage(match, gameId);
    });

    storeRef.current = store;
    setLoading(false);
  }, [userId, match, gameId]);

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

/*
 * Deep copy an object.
 */
function deepCopy<T>(obj: T): T {
  if (obj === undefined) {
    return obj;
  }

  return JSON.parse(JSON.stringify(obj));
}

const PlayerStats = ({ userId }: { userId: UserId }) => {
  const stats = useStore(
    (state) => state.match?.store.playerStats[userId] || [],
  );
  const username = useStore(
    (state) => state.match?.store.users.byId[userId]?.username,
  );

  return (
    <>
      <div className="font-medium">
        Stats for <span className="font-bold">{username}</span>
      </div>
      <div className="pl-2">
        {stats.length === 0 && <span className="italic">No stats</span>}
        {stats.map((stat, index) => (
          <div key={index}>
            {stat.key}: {stat.value}
          </div>
        ))}
      </div>
    </>
  );
};

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
  // This is a hack to refresh on every move.
  {
    const [, setRefreshCounter] = useState(0);

    const match = useStore((state) => state.match);

    useEffect(() => {
      if (!match) {
        return;
      }

      const handler = () => {
        setRefreshCounter((prev) => prev + 1);
      };

      match.addEventListener("move", handler);

      return () => {
        match.removeEventListener("move", handler);
      };
    }, [match]);
  }

  const store = useStore((state) => state.match?.store);

  if (!store) {
    return <div>Loading match state...</div>;
  }

  return (
    <div className="">
      {store.matchStatus || "no status"}
      {(["board", "playerboards", "secretboard"] as const).map((key) => (
        <JsonEditor
          key={key}
          data={store[key] as any}
          collapse={2}
          rootName={key}
          restrictEdit={true}
          restrictDelete={true}
          restrictAdd={true}
        />
      ))}
      {store.meta.players.allIds.map((userId) => (
        <PlayerStats userId={userId} key={userId} />
      ))}
      <div className="pt-4 font-bold">Match stats</div>
      <div className="pl-2">
        {store.matchStats.length === 0 && (
          <span className="italic">No stats</span>
        )}
        {store.matchStats.map((stat, index) => (
          <div key={index}>
            {stat.key}: {stat.value}
          </div>
        ))}
      </div>
      <div className="pt-4 font-bold">Delayed moves</div>
      <div className="pl-2">
        {Object.keys(store.delayedMoves).length === 0 && (
          <div className="italic">No delayed moves</div>
        )}
        {Object.entries(store.delayedMoves).map(([id, delayedMove]) => (
          <JsonEditor
            key={id}
            data={delayedMove as any}
            rootName={""}
            restrictEdit={true}
            restrictDelete={true}
            restrictAdd={true}
          />
        ))}
      </div>
    </div>
  );
}

function MatchSetting({
  matchValue,
  gameSetting,
}: {
  matchValue: string;
  gameSetting: GameSetting;
}) {
  const resetMatch = useStore((state) => state.resetMatch);
  const matchSettings = useStore((state) => state.match?.store.matchSettings);

  if (!matchSettings) {
    return null;
  }

  const { key, options } = gameSetting;
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{key}</label>
      <select
        className="border border-black w-full"
        value={matchValue}
        onChange={(e) => {
          resetMatch({
            matchSettings: { ...matchSettings, [key]: e.target.value },
          });
        }}
      >
        {options.map(({ value, isDefault }) => (
          <option key={value} value={value}>
            {value} {isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <div className="w-full px-1">
      <div className="rounded-lg bg-neutral-200 p-2 space-y-2 w-full">
        {children}
      </div>
    </div>
  );
}

function MatchSettingsView({ gameSettings }: { gameSettings: GameSettings_ }) {
  const matchSettings = useStore((state) => state.match?.store.matchSettings);

  if (!matchSettings) {
    return null;
  }

  return (
    <SettingsSection>
      {gameSettings.allIds.map((key) => (
        <MatchSetting
          key={key}
          gameSetting={gameSettings.byId[key]}
          matchValue={matchSettings[key]}
        />
      ))}
    </SettingsSection>
  );
}

function MatchPlayerSetting({
  userId,
  gameSetting,
  matchValue,
}: {
  userId: UserId;
  gameSetting: GameSetting;
  matchValue: string;
}) {
  const resetMatch = useStore((state) => state.resetMatch);
  const matchPlayersSettings = useStore(
    (state) => state.match?.store.matchPlayersSettings,
  );

  if (!matchPlayersSettings) {
    return null;
  }

  const { key, options } = gameSetting;
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{key}</label>
      <select
        className="border border-black w-full"
        value={matchValue}
        onChange={(e) => {
          resetMatch({
            matchPlayersSettings: {
              ...matchPlayersSettings,
              [userId]: {
                ...matchPlayersSettings[userId],
                [key]: e.target.value,
              },
            },
          });
        }}
      >
        {options.map(({ value, isDefault }) => (
          <option key={value} value={value}>
            {value} {isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
function MatchPlayerSettings({
  userId,
  gamePlayerSettings,
}: {
  userId: UserId;
  gamePlayerSettings: GamePlayerSettings_;
}) {
  const matchPlayersSettings = useStore(
    (state) => state.match?.store.matchPlayersSettings,
  );

  const username = useStore(
    (state) => state.match?.store.users.byId[userId]?.username,
  );

  if (!gamePlayerSettings || !matchPlayersSettings) {
    return null;
  }

  return (
    <div className="w-full">
      <label className="text-black font-semibold text-center w-full">
        {username}
      </label>
      {gamePlayerSettings.allIds.map((key) => (
        <MatchPlayerSetting
          key={key}
          userId={userId}
          gameSetting={gamePlayerSettings.byId[key]}
          matchValue={matchPlayersSettings[userId][key]}
        />
      ))}
    </div>
  );
}

function PlayerSettingsView({
  gamePlayerSettings,
}: {
  gamePlayerSettings: GamePlayerSettings_;
}) {
  const match = useStore((state) => state.match);
  if (!match) {
    return null;
  }
  const { users } = match.store;

  const userIds = Object.keys(users.byId);

  return (
    <SettingsSection>
      <div className="flex flex-col space-y-4">
        {userIds.map((userId) => (
          <MatchPlayerSettings
            key={userId}
            userId={userId}
            gamePlayerSettings={gamePlayerSettings}
          />
        ))}
      </div>
    </SettingsSection>
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

function SettingsButtons() {
  const setLayout = useStore((state) => state.setLayout);
  const toggleCollapsed = useStore((state) => state.toggleCollapsed);
  const toggleShowDimensions = useStore((state) => state.toggleShowDimensions);
  const layout = useStore((state) => state.layout);
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

  const { meta } = match.store;
  const userIds = meta.players.allIds;
  const numPlayers = userIds.length;

  return (
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
                resetMatch();
              }}
            >
              Reset Game State
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button
              onClick={() => {
                resetMatch({ numPlayers: numPlayers + 1 });
              }}
              disabled={numPlayers >= match.game.maxPlayers}
            >
              Add Player
            </Button>
            <Button
              onClick={() => {
                resetMatch({ numPlayers: numPlayers - 1 });
              }}
              disabled={numPlayers <= match.game.minPlayers}
            >
              Remove Player
            </Button>
          </ButtonRow>
        </>
      )}
    </div>
  );
}

function Settings() {
  const toggleCollapsed = useStore((state) => state.toggleCollapsed);
  const collapsed = useStore((state) => state.collapsed);
  const view = useStore((state) => state.view);

  const game = useStore((state) => state.game);
  const { gameSettings, gamePlayerSettings } = game;

  if (collapsed) {
    return (
      <div className="absolute right-0 top-0">
        <Button onClick={toggleCollapsed}>◀</Button>
      </div>
    );
  }

  return (
    <div className={classNames("flex w-1/4 min-w-60 flex-col", "space-y-2")}>
      <SettingsButtons />
      {view === "game" && (
        <>
          {!!gameSettings?.allIds?.length && (
            <div className="flex-initial max-h-1/8 overflow-y-auto">
              <MatchSettingsView gameSettings={gameSettings} />
            </div>
          )}
          {!!gamePlayerSettings?.allIds?.length && (
            <div className="flex-initial max-h-1/8 overflow-y-auto">
              <PlayerSettingsView gamePlayerSettings={gamePlayerSettings} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <MatchStateView />
          </div>
        </>
      )}
    </div>
  );
}

const ItsMyTurn = ({ userId }: { userId: UserId }) => {
  const match = useStore((state) => state.match);

  const [itsMyTurn, setItsMyTurn] = useState(
    () => match?.store.meta.players.byId[userId]?.itsYourTurn || false,
  );

  useEffect(() => {
    if (!match || userId === "spectator") {
      return;
    }

    const handler = (event: Event) => {
      const { detail } = event as CustomEvent;
      setItsMyTurn(detail.meta.players.byId[userId].itsYourTurn || false);
    };
    match.addEventListener("metaChanged", handler);

    return () => match.removeEventListener("metaChanged", handler);
  }, [match, userId]);

  return (
    <div
      className={classNames(
        "absolute inset-0 border",
        itsMyTurn ? "border-red-600" : "border-black",
      )}
    ></div>
  );
};

function PlayerIframe({ userId }: { userId: UserId }) {
  const locale = useStore((state) => state.locale);
  const ref = useRef<HTMLDivElement>(null);
  const { href } = window.location;

  // Force reloading the iframe when the component is rendered.
  const key = Math.random();

  return (
    <>
      <div
        className={classNames("w-full flex-1 h-0 overflow-hidden relative z-0")}
        key={userId}
        ref={ref}
      >
        <ItsMyTurn userId={userId} />
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
  const playerIds = useStore(
    (state) => state.match?.store.meta.players.allIds || [],
  );
  const userIds = [...playerIds, "spectator"];

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

export { AllMessages, BoardForPlayer, Lefun, Main, RulesWrapper };
