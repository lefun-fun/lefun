import { expectTypeOf, test } from "vitest";

import { MatchTester, PlayerMoveDef } from "@lefun/game";

import { Game, game, GS } from ".";

test("inside PlayerMoveDef", () => {
  expectTypeOf(game).toEqualTypeOf<Game>();

  const moveDef = {
    executeNow({ board, playerboard, payload }) {
      console.log(board, playerboard, payload);
    },
  } satisfies PlayerMoveDef<GS, { x: number }>;

  expectTypeOf(moveDef.executeNow).parameter(0).toMatchTypeOf<{
    board: GS["B"];
    playerboard: GS["PB"];
    payload: { x: number };
  }>();

  expectTypeOf(moveDef.executeNow).parameter(0).toMatchTypeOf<{
    board: { count: number };
  }>();
});

test("match tester", () => {
  const match = new MatchTester<GS, Game>({ gameDef: game, numPlayers: 2 });
  expectTypeOf(match.board.count).toEqualTypeOf<number>();
});
