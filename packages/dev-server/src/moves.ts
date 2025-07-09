import { applyPatches, Patch } from "immer";

import { GameStateBase } from "@lefun/game";

import { deepCopy } from "./utils";

export class OptimisticBoards<GS extends GameStateBase> {
  _confirmedBoard: GS["B"];
  _confirmedPlayerboard: GS["PB"];
  // The player's moves that have not been confirmed yet
  _pendingMoves: { moveId: string; patches: Patch[] }[];
  // ConfirmedBoard + pending moves updates: this is what we will display.
  board: GS["B"];
  playerboard: GS["PB"];

  constructor({
    board,
    playerboard,
  }: {
    board: GS["B"];
    playerboard: GS["PB"];
  }) {
    board = deepCopy(board);
    playerboard = deepCopy(playerboard);

    this._confirmedBoard = board;
    this._confirmedPlayerboard = playerboard;
    this._pendingMoves = [];
    this.board = board;
    this.playerboard = playerboard;
  }

  _getMoveIndex(moveId: string): number {
    for (let i = 0; i < this._pendingMoves.length; i++) {
      if (this._pendingMoves[i].moveId === moveId) {
        return i;
      }
    }

    return -1;
  }

  _replay() {
    let board = this._confirmedBoard;
    let playerboard = this._confirmedPlayerboard;
    for (const { patches } of this._pendingMoves) {
      ({ board, playerboard } = applyPatches({ board, playerboard }, patches));
    }
    this.board = board;
    this.playerboard = playerboard;
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
    const { _confirmedBoard: board, _confirmedPlayerboard: playerboard } = this;
    {
      const state = applyPatches({ board, playerboard }, patches);
      this._confirmedBoard = state.board;
      this._confirmedPlayerboard = state.playerboard;
    }

    // Remove the `moveId` if it's one of our moves.
    if (moveId) {
      const index = this._getMoveIndex(moveId);
      this._pendingMoves.splice(index, 1);
    }

    this._replay();
  }
}
