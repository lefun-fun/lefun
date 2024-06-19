/*
 * Local state management for the non-game stuff.
 */

import { createContext, useContext } from "react";
import { createStore as _createStore, useStore as _useStore } from "zustand";

import { Locale } from "@lefun/core";

type State = {
  collapsed: boolean;
  layout: "row" | "column";
  numPlayers: number;
  userIds: string[];
  showDimensions: boolean;
  locale: Locale;
  locales: Locale[];
  toggleShowDimensions: () => void;
  toggleCollapsed: () => void;
  toggleLayout: () => void;
  setNumPlayers: (numPlayers: number) => void;
  setLocale: (locale: Locale) => void;
};

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
    numPlayers: 0,
    userIds: [],
    showDimensions: false,
    locale: locales[0],
    locales,
    //
    toggleShowDimensions: () =>
      set((state) => ({ showDimensions: !state.showDimensions })),
    toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
    toggleLayout: () =>
      set((state) => ({ layout: state.layout === "row" ? "column" : "row" })),
    setNumPlayers: (numPlayers) => {
      localStorage.setItem("numPlayers", numPlayers.toString());
      set({
        numPlayers,
        userIds: Array.from({ length: numPlayers }, (_, i) => i.toString()),
      });
    },
    setLocale: (locale: Locale) => {
      localStorage.setItem("locale", locale);
      set({ locale });
    },
  }));

  {
    const numPlayersStorage = localStorage.getItem("numPlayers");
    if (numPlayersStorage) {
      numPlayers = parseInt(numPlayersStorage);
    }
    const { setNumPlayers } = store.getState();
    setNumPlayers(numPlayers);
  }

  {
    const localeStorage = localStorage.getItem("locale");
    const locale = localeStorage ? localeStorage : locales[0];
    const { setLocale } = store.getState();
    setLocale(locale as Locale);
  }

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
