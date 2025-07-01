// We import the CSS here so that rollup picks it up.
import "./index.css";

import { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import type { Locale, MatchPlayersSettings, MatchSettings } from "@lefun/core";
import { Game, Game_, parseGame } from "@lefun/game";

import { AllMessages, BoardForPlayer, Lefun, Main, RulesWrapper } from "./App";
import {
  loadMatchFromLocalStorage,
  Match,
  saveMatchToLocalStorage,
} from "./match";
import { createStore, MainStoreContext } from "./store";

function getUserIds(numPlayers: number) {
  return Array(numPlayers)
    .fill(null)
    .map((_, i) => i.toString());
}

const initMatch = ({
  game,
  matchData,
  gameData,
  locale,
  matchSettings,
  matchPlayersSettings,
  numPlayers,
}: {
  game: Game_;
  matchData: unknown;
  gameData: unknown;
  locale?: Locale;
  matchSettings?: MatchSettings;
  matchPlayersSettings?: MatchPlayersSettings;
  numPlayers?: number;
}) => {
  console.log("init", numPlayers);
  numPlayers ??= game.minPlayers;
  locale ??= "en";

  const { gameSettings, gamePlayerSettings } = game;

  if (!matchSettings) {
    matchSettings = {};

    if (gameSettings) {
      matchSettings = Object.fromEntries(
        gameSettings.allIds.map((key) => {
          const defaultValue = gameSettings.byId[key].defaultValue;
          return [key, defaultValue];
        }),
      );
    }
  }

  const userIds = getUserIds(numPlayers);

  if (!matchPlayersSettings) {
    matchPlayersSettings = {};
    if (gamePlayerSettings) {
      matchPlayersSettings = Object.fromEntries(
        userIds.map((userId) => [userId, {}]),
      );

      for (const key of gamePlayerSettings.allIds) {
        const taken = new Set();

        const { exclusive, options } = gamePlayerSettings.byId[key];

        for (const userId of userIds) {
          let found = false;
          for (const { value, isDefault } of options) {
            if (exclusive && !taken.has(value)) {
              matchPlayersSettings[userId][key] = value;
              taken.add(value);
              found = true;
              break;
            }

            if (isDefault && !exclusive) {
              matchPlayersSettings[userId][key] = value;
              found = true;
              break;
            }
          }
          if (!found) {
            if (exclusive) {
              throw new Error(
                `Not enough options for exclusive player setting "${key}"`,
              );
            } else {
              // Fallback on the first option.
              matchPlayersSettings[userId][key] = options[0].value;
            }
          }
        }
      }
    }
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

  console.log("players before ctr");
  console.log(players);

  const match = new Match({
    game,
    matchSettings,
    matchPlayersSettings,
    matchData,
    gameData,
    players,
    locale,
  });

  return match;
};

async function render({
  game,
  board,
  rules,
  matchData,
  gameData,
  idName = "home",
  messages = { en: {} },
  gameId = "unknown-game-id",
}: {
  game: Game;
  board: () => Promise<ReactNode>;
  rules?: () => Promise<ReactNode>;
  matchData?: any;
  gameData?: any;
  idName?: string;
  messages?: AllMessages;
  gameId: string;
}) {
  function renderComponent(content: ReactNode) {
    const container = document.getElementById(idName);
    const root = createRoot(container!);
    return root.render(content);
  }

  const game_ = parseGame(game);

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
        gameId={gameId}
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
    game: game_,
  });

  // sanity check
  if (locale) {
    throw new Error("locale should not be defined at this point");
  }

  locale = store.getState().locale;

  const resetMatch = ({
    numPlayers,
    locale,
    matchSettings,
    matchPlayersSettings,
  }: {
    numPlayers?: number;
    locale?: Locale;
    matchSettings?: MatchSettings;
    matchPlayersSettings?: MatchPlayersSettings;
  } = {}) => {
    let match = store.getState().match;

    console.log("num p", numPlayers);

    match = initMatch({
      game: game_,
      matchData,
      gameData,
      locale: locale || match?.store.meta.locale,
      numPlayers: numPlayers || match?.store.meta.players.allIds.length,
      matchSettings: matchSettings || match?.store.matchSettings,
      matchPlayersSettings:
        matchPlayersSettings ||
        (numPlayers === undefined
          ? match?.store.matchPlayersSettings
          : undefined),
    });

    // We use `window.lefun` to communicate between the host and the player boards.
    (window as any).lefun = { match };

    saveMatchToLocalStorage(match, gameId);

    store.setState(() => ({ match }));
  };

  store.setState(() => ({ game: game_, resetMatch }));

  // Try to load the match from local storage, or create a new one.
  {
    let match = loadMatchFromLocalStorage(game_, gameId);
    if (!match) {
      match = initMatch({
        game: game_,
        matchData,
        gameData,
      });
    }
    store.setState(() => ({ match }));
    (window as any).lefun = { match };
  }

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
