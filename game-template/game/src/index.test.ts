import { expect,test } from "vitest";

import { MatchTester as _MatchTester } from "@lefun/game";

import { Game, game, GS } from ".";

class MatchTester extends _MatchTester<GS, Game> {}

test("it works", () => {
  const match = new MatchTester({ gameDef: game, numPlayers: 2 });
  const { players } = match.board;

  const userId = Object.keys(players)[0];

  match.makeMove(userId, "roll");
  match.makeMove(userId, "moveWithArg", { someArg: "123" });
});
