// We import the CSS here so that rollup picks it up.
import "./index.css";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import classNames from "classnames";
import { enablePatches, Patch } from "immer";
import { JsonEditor } from "json-edit-react";
import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { proxy, snapshot, useSnapshot } from "valtio";

import {
  GameId,
  GamePlayerSettings_,
  GameSetting,
  GameSettings_,
  Locale,
  Meta,
  UserId,
} from "@lefun/core";
import {
  executePlayerMove,
  GameStateBase,
  MoveExecutionOutput,
} from "@lefun/game";
import {
  Selector,
  setMakeMove,
  setUseSelector,
  setUseSelectorShallow,
  setUseStore,
  UseSelector,
} from "@lefun/ui";

import {
  Backend,
  MOVE_EVENT,
  patchesForUserEvent,
  REVERT_MOVE_EVENT,
} from "./backend";
import { OptimisticBoards } from "./moves";
import { useStore } from "./store";
import { generateId } from "./utils";

const LATENCY = 100;

enablePatches();

/* Change
 *   path=playerboards/userId/xyz...
 * to
 *   path=playerboard/xyz...
 */
const reformatPlayerboardPatch = (patch: Patch) => {
  const { path } = patch;
  const [p0, , ...rest] = path;
  if (p0 === "playerboards") {
    return { ...patch, path: ["playerboard", ...rest] };
  }
  return patch;
};

const BoardForPlayer = ({
  BoardComponent,
  backend,
  userId,
  messages,
  locale,
  gameId,
}: {
  BoardComponent: () => ReactNode;
  backend: Backend;
  userId: UserId | "spectator";
  messages: Record<string, string>;
  locale: Locale;
  gameId: GameId;
}) => {
  useEffect(() => {
    i18n.loadAndActivate({ locale, messages });
  }, [locale, messages]);

  const [loading, setLoading] = useState(true);

  // Here we use `valtio` as a test to see how well it works as a local state
  // management solution. So far it's pretty good, perhaps we should also use it for the dev-server settings!
  const optimisticBoards = useRef(
    proxy(
      new OptimisticBoards({
        board: backend.store.board,
        playerboard: backend.store.playerboards[userId] || null,
        meta: backend.store.meta,
      }),
    ),
  );

  useEffect(() => {
    const { store: mainStore } = backend;

    backend.addEventListener(patchesForUserEvent(userId), (event: any) => {
      if (!event) {
        return;
      }

      const { moveId, patches } = event.detail;

      // Wait before we apply the updates to simulate a network latency.
      setTimeout(() => {
        optimisticBoards.current.confirmMove({ moveId, patches });
      }, LATENCY);
    });

    backend.addEventListener(REVERT_MOVE_EVENT, (event: any) => {
      const { moveId } = event.detail;
      optimisticBoards.current.revertMove(moveId);
    });

    setMakeMove((name, payload) => {
      if (userId === "spectator") {
        console.warn("spectator cannot make moves");
        return;
      }

      if (backend.store.matchStatus === "over") {
        console.warn("match is over");
        return;
      }

      let result: MoveExecutionOutput | null = null;

      try {
        result = executePlayerMove({
          name,
          payload,
          game: backend.game,
          userId,
          board: optimisticBoards.current.board,
          playerboards: { [userId]: optimisticBoards.current.playerboard },
          secretboard: null,
          now: new Date().getTime(),
          random: backend.random,
          skipCanDo: false,
          onlyExecuteNow: true,
          // Note that technically we should not use anything from
          // `match.store` as this represents the DB.
          matchData: backend.store.matchData,
          gameData: backend.store.gameData,
          meta: backend.store.meta,
        });
      } catch {
        console.warn(
          `Ignoring move "${name}" for user "${userId}" because of error`,
        );
        return;
      }

      let { patches } = result;
      patches = patches.map(reformatPlayerboardPatch);

      const moveId = generateId();
      optimisticBoards.current.makeMove(moveId, patches);

      // Run the move in the backend also.
      backend.makeMove({ userId, name, payload, moveId });
    });

    const { users } = mainStore;

    const _useSelector = (): UseSelector<GameStateBase> => {
      // We wrap it to respect the rules of hooks.
      const useSelector = <GS extends GameStateBase, T>(
        selector: Selector<GS, T>,
      ): T => {
        const snapshot = useSnapshot(optimisticBoards.current);
        const board = snapshot.board;
        const playerboard = snapshot.playerboard;
        const meta = snapshot.meta as Meta;
        return selector({
          board,
          playerboard,
          meta,
          userId,
          users,
          timeDelta: 0,
          timeLatency: 0,
        });
      };
      return useSelector;
    };

    setUseSelector(_useSelector);

    setUseStore(() => {
      const playerboard = optimisticBoards.current.playerboard;
      return {
        board: snapshot(optimisticBoards.current.board),
        playerboard: playerboard === null ? null : snapshot(playerboard),
        meta: snapshot(optimisticBoards.current.meta) as Meta,
        userId,
        users,
        timeDelta: 0,
        timeLatency: 0,
      };
    });

    // As far as I know, valtio does not support shallow selectors, but if I understand correctly it's not a concern with Valtio.
    setUseSelectorShallow(_useSelector);

    setLoading(false);
  }, [userId, backend, gameId]);

  if (loading) {
    return <div>Loading player...</div>;
  }

  return (
    <I18nProvider i18n={i18n}>
      <div style={{ height: "100%", width: "100%" }}>
        <BoardComponent />
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

const PlayerStats = ({ userId }: { userId: UserId }) => {
  const stats = useStore(
    (state) => state.match?.store.playerStats[userId] || [],
  );
  const username = useStore(
    (state) => state.match?.store.users[userId]?.username,
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

      match.addEventListener(MOVE_EVENT, handler);

      return () => {
        match.removeEventListener(MOVE_EVENT, handler);
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
      {(["board", "playerboards", "secretboard", "meta"] as const).map(
        (key) => (
          <JsonEditor
            key={key}
            data={store[key] as any}
            collapse={2}
            rootName={key}
            restrictEdit={true}
            restrictDelete={true}
            restrictAdd={true}
          />
        ),
      )}
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
          gameSetting={gameSettings.byId[key]!}
          matchValue={matchSettings[key]!}
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
    (state) => state.match?.store.users[userId]?.username,
  );

  if (!gamePlayerSettings || !matchPlayersSettings) {
    return null;
  }

  return (
    <div className="w-full">
      <input
        type="text"
        className="text-black font-semibold w-full"
        value={username}
        onChange={() => {
          console.warn("NOT IMPLEMENTED YET change username");
        }}
      />
      {gamePlayerSettings.allIds.map((key) => (
        <MatchPlayerSetting
          key={key}
          userId={userId}
          gameSetting={gamePlayerSettings.byId[key]!}
          matchValue={matchPlayersSettings[userId]![key]!}
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

  const userIds = Object.keys(users);

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
  if (s === "") {
    return "";
  }
  return s && s[0]!.toUpperCase() + s.slice(1);
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

  const ref = useRef<HTMLDivElement>(null);

  const [itsMyTurn, setItsMyTurn] = useState(
    () => match?.store.meta.players.byId[userId]?.itsYourTurn || false,
  );

  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!match || userId === "spectator") {
      return;
    }

    let interval: NodeJS.Timeout;

    const handler = () => {
      if (interval) {
        clearInterval(interval);
      }
      const myTurn = match.store.meta.players.byId[userId]!.itsYourTurn;
      setItsMyTurn(myTurn);

      if (!myTurn) {
        setWidth(0);
        return;
      }

      const beganAt = match?.store.meta.players.byId[userId]!.turnBeganAt;
      const expiresAt = match?.store.meta.players.byId[userId]!.turnExpiresAt;

      if (expiresAt) {
        interval = setInterval(() => {
          const totalWidth = ref.current?.clientWidth || 0;
          const now = new Date().getTime();
          if (!beganAt) {
            console.warn("beganAt is undefined");
            return;
          }
          const width = ((now - beganAt) / (expiresAt - beganAt)) * totalWidth;
          setWidth(Math.min(width, totalWidth));
        }, 50);
      }
    };
    match.addEventListener(patchesForUserEvent(userId), handler);

    return () => {
      match.removeEventListener(patchesForUserEvent(userId), handler);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [match, userId]);

  return (
    <div
      className={classNames(
        "text-xs text-center",
        "relative w-full h-4 z-0",
        itsMyTurn ? "font-semibold bg-red-200" : "bg-gray-100",
      )}
      ref={ref}
    >
      {itsMyTurn && (
        <div
          className="absolute left-0 top-0 h-full bg-black opacity-10 z-10"
          style={{ width }}
        ></div>
      )}
      {userId}
    </div>
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
        className={classNames(
          "w-full flex-1 h-0 flex flex-col overflow-hidden relative z-0",
        )}
        key={userId}
        ref={ref}
      >
        <div className="flex-1 w-full">
          <iframe
            className="z-10 relative bg-white w-full h-full"
            src={`${href}?u=${userId}&l=${locale}`}
            key={key}
          ></iframe>
        </div>
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
              {userId === "spectator" ? (
                <div className="bg-neutral-200 text-center text-xs h-4">
                  Spectator
                </div>
              ) : (
                <ItsMyTurn userId={userId} />
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
  backend: Backend;
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

type AllMessages = Record<Locale, Record<string, string>>;

export { AllMessages, BoardForPlayer, Lefun, Main, RulesWrapper };
