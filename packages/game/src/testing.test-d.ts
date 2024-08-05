import { describe, test } from "vitest";

import { Game, GameState, PlayerMove } from ".";
import { MatchTester } from "./testing";

describe("MatchTester", () => {
  test("makeMove", () => {
    type GS = GameState<{
      x: number;
    }>;

    const move1: PlayerMove<GS, { a: number }> = {
      executeNow({ board, payload }) {
        board.x += payload.a;
      },
    };

    const game = {
      playerMoves: { move1 },
      initialBoards: () => ({ board: { x: 0 } }),
      minPlayers: 1,
      maxPlayers: 10,
    } satisfies Game<GS>;

    type G = typeof game;

    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });

    const userId = "userId";

    // @ts-expect-error missing arg
    match.makeMove(userId, "move1");

    // @ts-expect-error wrong arg key
    match.makeMove(userId, "move1", { b: 3 });

    // @ts-expect-error wrong arg value type
    match.makeMove(userId, "move1", { a: "abc" });

    match.makeMove(userId, "move1", { a: 3 });
  });
});
