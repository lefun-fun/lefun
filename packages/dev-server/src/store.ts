/*
 * Local state management for the non-game stuff.
 */

import { createContext, useContext } from "react";
import { createStore as _createStore, useStore as _useStore } from "zustand";

import type { Locale, UserId } from "@lefun/core";

const KEYS_TO_LOCAL_STORAGE: (keyof State)[] = [
  "numPlayers",
  "visibleUserId",
  "locale",
  "showDimensions",
  "layout",
  "collapsed",
];

type Layout = "row" | "column";

type State = {
  collapsed: boolean;
  layout: Layout;
  visibleUserId: UserId | "all";
  numPlayers: number;
  showDimensions: boolean;
  locale: Locale;
  locales: Locale[];
  toggleShowDimensions: () => void;
  toggleCollapsed: () => void;
  setLayout: (layout: Layout) => void;
  setNumPlayers: (numPlayers: number) => void;
  setLocale: (locale: Locale) => void;
  setVisibleUserId: (userId: UserId | "all") => void;
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

function createStore({
  numPlayers,
  locales,
}: {
  numPlayers: number;
  locales: Locale[];
}) {
  const store = _createStore<State>()((set) => ({
    collapsed: false,
    layout: "row",
    numPlayers,
    visibleUserId: "all",
    showDimensions: false,
    locale: locales[0],
    locales,
    //
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
    setNumPlayers: (numPlayers) => {
      set({ numPlayers });
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
