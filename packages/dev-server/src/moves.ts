import { applyPatches, Patch } from "immer";

import { Meta } from "@lefun/core";
import { GameStateBase } from "@lefun/game";

import { deepCopy } from "./utils";

export class OptimisticBoards<GS extends GameStateBase = GameStateBase> {
  _confirmedBoard: GS["B"];
  _confirmedPlayerboard: GS["PB"] | null;
  _confirmedMeta: Meta;
  // The player's moves that have not been confirmed yet
  _pendingMoves: { moveId: string; patches: Patch[] }[];
  // ConfirmedBoard + pending moves updates: this is what we will display.
  board: GS["B"];
  // `null` for spectators. Note that GS["PB"] can itself be `null` for games without playerboards.
  playerboard: GS["PB"] | null;

  meta: Meta;

  constructor({
    board,
    playerboard,
    meta,
  }: {
    board: GS["B"];
    playerboard: GS["PB"] | null;
    meta: Meta;
  }) {
    board = deepCopy(board);
    playerboard = deepCopy(playerboard);
    meta = deepCopy(meta);

    this._confirmedBoard = board;
    this._confirmedPlayerboard = playerboard;
    this._confirmedMeta = meta;
    this._pendingMoves = [];
    this.board = board;
    this.playerboard = playerboard;
    this.meta = meta;
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
    let board = this._confirmedBoard;
    let playerboard = this._confirmedPlayerboard;
    let meta = this._confirmedMeta;
    for (const { patches } of this._pendingMoves) {
      ({ board, playerboard, meta } = applyPatches(
        { board, playerboard, meta },
        patches,
      ));
    }
    this.board = board;
    this.playerboard = playerboard;
    this.meta = meta;
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
    // Start from the confirmed boards
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
