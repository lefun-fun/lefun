/*
 * Local state management for the non-game stuff.
 */

import { createContext, useContext } from "react";
import { createStore as _createStore, useStore as _useStore } from "zustand";

import type { Locale, Meta, UserId } from "@lefun/core";
import { Game_ } from "@lefun/game";

import type { Match } from "./match";

const KEYS_TO_LOCAL_STORAGE: (keyof State)[] = [
  "visibleUserId",
  "locale",
  "showDimensions",
  "layout",
  "collapsed",
  "view",
];

type Layout = "row" | "column";

type View = "game" | "rules";

type State = {
  collapsed: boolean;
  layout: Layout;
  visibleUserId: UserId | "all" | "spectator";
  showDimensions: boolean;
  locale: Locale;
  locales: Locale[];
  view: View;
  game: Game_;
  match: Match | undefined;
  //
  toggleShowDimensions: () => void;
  toggleCollapsed: () => void;
  setLayout: (layout: Layout) => void;
  setLocale: (locale: Locale) => void;
  setVisibleUserId: (userId: UserId | "all" | "spectator") => void;
  setView: (view: View) => void;
  resetMatch: (arg0?: {
    locale?: Locale;
    numPlayers?: number;
    matchSettings?: any;
    matchPlayersSettings?: any;
  }) => void;
};

function saveToLocalStorage(state: Partial<State>): void {
  const obj = {} as any;
  for (const key of KEYS_TO_LOCAL_STORAGE) {
    obj[key] = state[key];
  }

  localStorage.setItem("state", JSON.stringify(obj));
}

function loadFromLocalStorage(store: ReturnType<typeof createStore>) {
  const obj = JSON.parse(localStorage.getItem("state") || "{}");
  store.setState(obj);
}

function createStore({ locales, game }: { locales: Locale[]; game: Game_ }) {
  const store = _createStore<State>()((set) => ({
    collapsed: false,
    layout: "row",
    visibleUserId: "all",
    showDimensions: false,
    locale: locales[0],
    locales,
    view: "game",
    match: undefined,
    game,
    //
    meta: undefined,
    //
    resetMatch: () => {
      // This is set in App.tsx
    },
    toggleShowDimensions: () => {
      set((state) => ({ showDimensions: !state.showDimensions }));
      saveToLocalStorage(store.getState());
    },
    toggleCollapsed: () => {
      set((state) => ({ collapsed: !state.collapsed }));
      saveToLocalStorage(store.getState());
    },
    setLayout: (layout: Layout) => {
      set({ layout });
      saveToLocalStorage(store.getState());
    },
    setLocale: (locale: Locale) => {
      set({ locale });
      saveToLocalStorage(store.getState());
    },
    setVisibleUserId: (userId: UserId | "all") => {
      set({ visibleUserId: userId });
      saveToLocalStorage(store.getState());
    },
    setView: (view: View) => {
      set({ view });
      saveToLocalStorage(store.getState());
    },
  }));

  loadFromLocalStorage(store);

  return store;
}

const MainStoreContext = createContext<ReturnType<typeof createStore> | null>(
  null,
);

function useStore<V>(selector: (state: State) => V) {
  const store = useContext(MainStoreContext);
  if (!store) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return _useStore(store, selector);
}

export { createStore, MainStoreContext, useStore };
