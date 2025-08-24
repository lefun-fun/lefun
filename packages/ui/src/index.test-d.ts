import { test } from "vitest";

import type { BoardMove, Game, GameState, PlayerMove } from "@lefun/game";

import { makeUseMakeMove, useMakeMove } from "./index";

test("makeMove - payload-typed", () => {
  type GS = GameState<{ x: number }>;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    initialBoards: () => ({ board: { x: 2 } }),
    playerMoves: { move1, move2 },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;

  type G = typeof game;

  {
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
  }

  // No `makeUseMakeMove` but with the <G>.
  {
    const makeMove = useMakeMove<G>();

    // @ts-expect-error wrong move name
    makeMove("patate");

    makeMove("move1");
    makeMove("move2");
    makeMove("move2", { x: 123 });
    makeMove("move1", { x: 123 });
    makeMove("move2", { x: "123" });
    makeMove("move2", { y: 123 });
  }

  // No `G`.
  {
    const makeMove = useMakeMove();

    makeMove("patate");
    makeMove("move1");
    makeMove("move2");
    makeMove("move2", { x: 123 });
    makeMove("move1", { x: 123 });
    makeMove("move2", { x: "123" });
    makeMove("move2", { y: 123 });
  }
});

test("makeMove - player-moves-typed", () => {
  type Move2Payload = {
    x: number;
  };

  type PMT = {
    move1: null;
    move2: Move2Payload;
    move3: Move2Payload;
  };

  type BMT = {
    boardMove: null;
  };

  const move1: PlayerMove<GS, null, PMT, BMT> = {
    execute() {},
    executeNow({ payload }) {
      console.log(payload);
    },
  };

  const move2: PlayerMove<GS, Move2Payload, PMT, BMT> = {
    execute({ payload }) {
      console.log(payload);
    },
    executeNow({ payload }) {
      console.log(payload);
    },
  };

  const move3: PlayerMove<GS, Move2Payload, PMT, BMT> = {
    executeNow({ payload }) {
      console.log(payload);
    },
  };

  const boardMove: BoardMove<GS, null, PMT, BMT> = {
    execute() {},
  };

  type GS = GameState<{ x: number }>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    initialBoards: () => ({ board: { x: 2 } }),
    playerMoves: { move1, move2, move3 },
    boardMoves: { boardMove },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS, PMT, BMT>;

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
