import { expect, test } from "vitest";

import { MatchTester as _MatchTester, MatchTesterOptions } from "@lefun/game";

import { autoMove } from "./backend";
import { G, game, GS, MATCH_DURATION, TURN_DURATION } from "./game";

class MatchTester extends _MatchTester<GS, G> {
  constructor(options: Omit<MatchTesterOptions<GS, G>, "game" | "autoMove">) {
    super({
      ...options,
      game,
      autoMove,
    });
  }
}

test("happy path", () => {
  const match = new MatchTester({ numPlayers: 3 });
  const [p0, p1, p2] = match.board.playerOrder;

  match.makeMove(p0, "roll");
  match.makeMove(p1, "roll");
  match.makeMove(p2, "roll");
  expect(() => match.makeMove(p1, "roll")).toThrowError("not your turn");
  match.makeMove(p0, "roll");
  match.makeMove(p1, "roll");

  match.fastForward(TURN_DURATION);

  expect(match.board.players[p2].isDead).toBe(true);
  expect(match.board.currentPlayerIndex).toEqual(0);
  match.makeMove(p0, "roll");
  match.makeMove(p1, "roll");
  match.fastForward(TURN_DURATION);
  match.makeMove(p1, "roll");
  match.makeMove(p1, "roll");
  match.makeMove(p1, "roll");
  expect(match.matchHasEnded).toBe(false);
  match.fastForward(MATCH_DURATION - 2 * TURN_DURATION);
  expect(match.matchHasEnded).toBe(true);
});

const _sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

test("bots and turns", async () => {
  const match = new MatchTester({ numPlayers: 0, numBots: 2 });
  await match.start({ max: 50 });
  await _sleep(100);
  match.fastForward(MATCH_DURATION);
  expect(match.matchHasEnded).toBe(true);
});
