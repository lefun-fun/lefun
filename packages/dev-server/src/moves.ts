import { applyPatches, Patch } from "immer";
import { createStore, StoreApi } from "zustand";

import { Meta, UserId } from "@lefun/core";
import { GameStateBase } from "@lefun/game";
import { User } from "@lefun/ui";

type Store<GS extends GameStateBase> = {
  board: GS["B"];
  playerboard: GS["PB"];
  meta: Meta;
  userId: UserId;
  users: Record<UserId, User>;
  timeDelta: number;
  timeLatency: number;
};

export class OptimisticBoards<GS extends GameStateBase = GameStateBase> {
  _confirmedBoard: GS["B"];
  _confirmedPlayerboard: GS["PB"] | null;
  _confirmedMeta: Meta;
  // The player's moves that have not been confirmed yet
  _pendingMoves: { moveId: string; patches: Patch[] }[];

  store: StoreApi<Store<GS>>;

  constructor({
    board,
    playerboard,
    meta,
    userId,
    users,
  }: {
    board: GS["B"];
    playerboard: GS["PB"] | null;
    meta: Meta;
    userId: UserId;
    users: Record<UserId, User>;
  }) {
    this._confirmedBoard = board;
    this._confirmedPlayerboard = playerboard;
    this._confirmedMeta = meta;
    this._pendingMoves = [];

    this.store = this._createStore({ userId, users });
  }

  /* Create the zustand store */
  _createStore({
    userId,
    users,
  }: {
    userId: UserId;
    users: Record<UserId, User>;
  }) {
    const store = createStore<Store<GS>>()(() => ({
      // These will contain the confirmed boards + patches from the pending moves.
      board: this._confirmedBoard,
      playerboard: this._confirmedPlayerboard,
      meta: this._confirmedMeta,
      //
      userId,
      users,
      timeDelta: 0,
      timeLatency: 0,
    }));

    return store;
  }

  _getMoveIndex(moveId: string): number {
    for (let i = 0; i < this._pendingMoves.length; i++) {
      if (this._pendingMoves[i]!.moveId === moveId) {
        return i;
      }
    }

    return -1;
  }

  _replay() {
    this.store.setState((oldState) => {
      let newState = {
        board: this._confirmedBoard,
        playerboard: this._confirmedPlayerboard,
        meta: this._confirmedMeta,
      };

      for (const { patches } of this._pendingMoves) {
        newState = applyPatches(newState, patches);
      }
      return { ...oldState, ...newState };
    });
  }

  makeMove(moveId: string, patches: Patch[]) {
    this._pendingMoves.push({ moveId, patches });
    this._replay();
  }

  revertMove(moveId: string) {
    const index = this._getMoveIndex(moveId);
    if (index === -1) {
      console.warn(`Move ${moveId} not found in pending moves.`);
      return;
    }
    this._pendingMoves.splice(index, 1);
    this._replay();
  }

  /*
   * Note that in general we get more patches than the ones we have in
   * our state, because of the `execute` bits. In our state we only
   * have the `executeNow` patches.
   */
  confirmMove({ moveId, patches }: { moveId?: string; patches: Patch[] }) {
    // Add the patches to the confirmedBoard, changing at few fields as possible (using Immer).
    const {
      _confirmedBoard: board,
      _confirmedPlayerboard: playerboard,
      _confirmedMeta: meta,
    } = this;

    {
      const state = applyPatches({ board, playerboard, meta }, patches);
      this._confirmedBoard = state.board;
      this._confirmedPlayerboard = state.playerboard;
      this._confirmedMeta = state.meta;
    }

    // Remove the `moveId` if it's one of our moves.
    if (moveId) {
      const index = this._getMoveIndex(moveId);
      this._pendingMoves.splice(index, 1);
    }

    this._replay();
  }
}
