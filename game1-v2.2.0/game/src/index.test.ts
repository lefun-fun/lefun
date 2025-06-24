import { expect, test } from "vitest";

import { MatchTester as _MatchTester } from "@lefun/game";

import { game, RollGame as G, RollGameState as GS } from ".";

class MatchTester extends _MatchTester<GS, G> {}

test("sanity check", () => {
  const match = new MatchTester({ game, numPlayers: 2 });
  const { players } = match.board;

  const userId = Object.keys(players)[0];

  match.makeMove(userId, "roll");
  match.makeMove(userId, "roll", {}, { canFail: true });
  match.makeMove(userId, "moveWithArg", { someArg: "123" });
  match.makeMove(userId, "moveWithArg", { someArg: "123" }, { canFail: true });

  // Time has no passed yet
  expect(match.board.lastSomeBoardMoveValue).toBeUndefined();

  // Not enough time
  match.fastForward(50);
  expect(match.board.lastSomeBoardMoveValue).toBeUndefined();

  // Enough time
  match.fastForward(50);
  expect(match.board.lastSomeBoardMoveValue).toEqual(3);
});
