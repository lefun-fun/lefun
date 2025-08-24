import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render as rtlRender, RenderResult } from "@testing-library/react";
import { ElementType, ReactNode } from "react";

import { UserId } from "@lefun/core";
import { GameStateBase, MatchTester } from "@lefun/game";
import {
  setMakeMove,
  setUseSelector,
  setUseSelectorShallow,
  setUseStore,
  UIState,
  Users,
} from "@lefun/ui";

export function getUIStateFromMatchTester({
  matchTester,
  userId,
}: {
  matchTester: MatchTester<any, any>;
  userId: UserId;
}): UIState {
  const { board, playerboards, meta } = matchTester;
  const users: Users = {};

  for (const userId of meta.players.allIds) {
    users[userId] = { username: `User ${userId}` };
  }

  return {
    userId,
    board,
    playerboard: playerboards[userId],
    meta,
    users,
    timeLatency: 0,
    timeDelta: 0,
  };
}

export function render(
  Board: ElementType,
  state: UIState<GameStateBase>,
  locale: string = "en",
): RenderResult {
  const userId = state.userId;
  // Sanity check
  if (userId == null) {
    throw new Error("userId should not be null");
  }

  // Simply create a store that always use our `state.
  setMakeMove(() => {});
  setUseSelector(() => (selector) => {
    return selector(state);
  });
  setUseSelectorShallow(() => (selector) => {
    return selector(state);
  });

  setUseStore(() => state);

  i18n.loadAndActivate({
    locale,
    // TODO Actually load the game's messages for the given locale.
    messages: {},
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
  };
  return rtlRender(<Board userId={userId} />, { wrapper });
}
