import { expectTypeOf, test } from "vitest";

import { MatchTester, PlayerMove } from "@lefun/game";

import { game, RollGame, RollGameState as GS } from ".";

test("inside PlayerMove", () => {
  expectTypeOf(game).toEqualTypeOf<RollGame>();

  const move: PlayerMove<GS, { x: number }> = {
    executeNow() {
      //
    },
  };

  expectTypeOf(move.executeNow).parameter(0).toMatchTypeOf<{
    board: GS["B"];
    playerboard: GS["PB"];
    payload: { x: number };
  }>();

  expectTypeOf(move.executeNow).parameter(0).toMatchTypeOf<{
    board: { count: number };
  }>();
});

test("match tester", () => {
  const match = new MatchTester<GS, typeof game>({ game, numPlayers: 2 });
  expectTypeOf(match.board.count).toEqualTypeOf<number>();
});
