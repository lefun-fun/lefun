import { test } from "vitest";

import { MatchTester as _MatchTester } from "@lefun/game";

import { game, RollGame as G, RollGameState as GS } from ".";

class MatchTester extends _MatchTester<GS, G> {}

test("sanity check", () => {
  const match = new MatchTester({ game, numPlayers: 2 });
  const { players } = match.board;

  const userId = Object.keys(players)[0];

  match.makeMove(userId, "roll");
  match.makeMove(userId, "moveWithArg", { someArg: "123" });
});
