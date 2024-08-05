import { test } from "vitest";

import type { Game, GameState, PlayerMove } from "@lefun/game";

import { makeUseMakeMove } from "./index";

test("makeMove - payload-typed", () => {
  const move1: PlayerMove<GS, null> = {
    executeNow: ({ payload }) => {
      console.log(payload);
    },
  };

  const move2: PlayerMove<GS, { x: number }> = {
    execute: () => {
      //
    },
  };

  type GS = GameState<{ x: number }>;

  const game = {
    version: "2.3.0",
    initialBoards: () => ({ board: { x: 2 } }),
    playerMoves: { move1, move2 },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;

  type G = typeof game;

  const useMakeMove = makeUseMakeMove<G>();
  const makeMove = useMakeMove();

  // @ts-expect-error wrong move name
  makeMove("patate");

  makeMove("move1");

  // @ts-expect-error missing payload
  makeMove("move2");

  makeMove("move2", { x: 123 });
  // @ts-expect-error superfluous payload
  makeMove("move1", { x: 123 });

  // @ts-expect-error wrong payload type
  makeMove("move2", { x: "123" });

  // @ts-expect-error wrong payload key
  makeMove("move2", { y: 123 });
});

test("makeMove - not-payload-typed", () => {
  const move1: PlayerMove<GS> = {
    executeNow: ({ payload }) => {
      console.log(payload);
    },
  };

  const move2: PlayerMove<GS> = {
    execute: () => {
      //
    },
  };

  type GS = GameState<{ x: number }>;

  const game = {
    version: "2.3.0",
    initialBoards: () => ({ board: { x: 2 } }),
    playerMoves: { move1, move2 },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;

  type G = typeof game;

  const useMakeMove = makeUseMakeMove<G>();
  const makeMove = useMakeMove();

  // @ts-expect-error wrong move name
  makeMove("patate");

  // They all work because we didn't specify the payload type.
  makeMove("move1");
  makeMove("move2");
  makeMove("move2", { x: 123 });
  makeMove("move1", { x: 123 });
  makeMove("move2", { x: "123" });
  makeMove("move2", { y: 123 });
});
