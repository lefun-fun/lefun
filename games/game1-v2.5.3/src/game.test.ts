import { expect, test } from "vitest";

import { MatchTester as _MatchTester, MatchTesterOptions } from "@lefun/game";

import { autoMove } from "./backend";
import { G, game, GS } from "./game";

class MatchTester extends _MatchTester<GS, G> {
  constructor(options: Omit<MatchTesterOptions<GS, G>, "game" | "autoMove">) {
    super({
      ...options,
      game,
      autoMove,
    });
  }
}

test("sanity check", () => {
  const match = new MatchTester({ numPlayers: 2 });
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

test("turns in tests", () => {
  const match = new MatchTester({ numPlayers: 2 });

  const [p0, p1] = match.board.playerOrder;

  expect(match.meta.players.byId[p0].itsYourTurn).toBe(true);
  expect(match.meta.players.byId[p1].itsYourTurn).toBe(false);

  match.makeMove(p0, "roll");
  expect(match.meta.players.byId[p0].itsYourTurn).toBe(false);
  expect(match.meta.players.byId[p1].itsYourTurn).toBe(true);

  match.makeMove(p0, "moveWithArg", { someArg: "123" });
  expect(match.meta.players.byId[p0].itsYourTurn).toBe(false);
  expect(match.meta.players.byId[p1].itsYourTurn).toBe(true);
});

test("bots and turns", async () => {
  const match = new MatchTester({ numPlayers: 0, numBots: 2 });
  await match.start();
  expect(match.board.sum).toBeGreaterThanOrEqual(20);
  expect(match.matchHasEnded).toBe(true);
});
