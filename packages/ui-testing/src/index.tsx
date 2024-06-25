import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render as rtlRender, RenderResult } from "@testing-library/react";
import { ElementType, ReactNode } from "react";
import { createStore } from "zustand";

import { GameStateBase } from "@lefun/game";
import { MatchState, setMakeMove, storeContext } from "@lefun/ui";

export function render<GS extends GameStateBase>(
  Board: ElementType,
  state: MatchState<GS>,
  locale: string = "en",
): RenderResult {
  const userId = state.userId;
  // Sanity check
  if (userId == null) {
    throw new Error("userId should not be null");
  }

  const store = createStore<MatchState<GS>>()(() => ({
    ...state,
  }));

  // Simply create a store that always use our `state.
  setMakeMove(() => {});

  i18n.loadAndActivate({
    locale,
    // TODO Actually load the game's messages for the given locale.
    messages: {},
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return (
      <storeContext.Provider value={store}>
        <I18nProvider i18n={i18n}>{children}</I18nProvider>
      </storeContext.Provider>
    );
  };
  return rtlRender(<Board userId={userId} />, { wrapper });
}
