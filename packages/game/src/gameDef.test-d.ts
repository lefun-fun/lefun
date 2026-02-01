import { describe, expectTypeOf, test } from "vitest";

import {
  AutoMove,
  BoardMove,
  Game,
  GameState,
  GetPayload,
  PlayerMove,
} from "./gameDef";

test("PlayerMove - fully-typed", () => {
  type B = {
    x: number;
  };

  type GS = GameState<B>;

  type PMT = {
    move1: null;
    move2: { a: number };
  };

  type BMT = {
    boardMove: { payload: string };
  };

  type Payload = { y: string };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payloadMove: PlayerMove<GS, Payload, PMT, BMT> = {
    executeNow({ board, payload, delayMove, turns }) {
      expectTypeOf(board).toMatchTypeOf<{ x: number }>();
      expectTypeOf(payload).toMatchTypeOf<{ y: string }>();

      //
      // delayMove

      // @ts-expect-error missing payload
      delayMove("boardMove", 1000);

      // @ts-expect-error wrong name
      delayMove("boardMove2", 1000);

      delayMove("boardMove", { payload: "patate" }, 123);

      //
      // turns.begin

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error missing payload
          boardMove: "boardMove",
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error wrong arg
          boardMove: ["boardMove", { patate: 123 }],
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          boardMove: ["boardMove", { payload: "patate" }],
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error wrong move name
          playerMove: "patate",
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error extra arg
          playerMove: ["move1", { a: 2 }],
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          playerMove: "move1",
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error missing arg
          playerMove: "move2",
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          // @ts-expect-error wrong arg
          playerMove: ["move2", { a: "abc" }],
        },
      });

      turns.begin("userId", {
        expiresIn: 1000,
        onExpiration: {
          playerMove: ["move2", { a: 123 }],
        },
      });
    },
  };
});

test("PlayerMove - payload-typed", () => {
  type B = {
    x: number;
  };

  type GS = GameState<B>;

  type Payload = { y: string };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payloadMove: PlayerMove<GS, Payload> = {
    executeNow({ board, payload, delayMove, turns }) {
      expectTypeOf(board).toMatchTypeOf<{ x: number }>();
      expectTypeOf(payload).toMatchTypeOf<{ y: string }>();

      delayMove("boardMove", 1000);
      delayMove("boardMove", { payload: "patate" }, 123);

      // Everything goes when we don't have PMT/BMT typing.
      turns.begin("userId", {
        expiresIn: 123,
        onExpiration: { playerMove: "move1" },
      });
      turns.begin("userId", {
        expiresIn: 123,
        onExpiration: {
          playerMove: ["move1", { arg: 123 }],
        },
      });
      turns.begin("userId", {
        expiresIn: 123,
        onExpiration: { boardMove: "move2" },
      });
      turns.begin("userId", {
        expiresIn: 123,
        onExpiration: {
          boardMove: ["move2", { arg: 123 }],
        },
      });

      // @ts-expect-error missing arg
      turns.begin("userId", { expiresIn: 123 });
    },
  };
});

test("PlayerMove inside game - only payload typed", () => {
  type B = {
    x: number;
  };

  type GS = GameState<B>;

  type Payload = { y: string };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payloadMove: PlayerMove<GS, Payload> = {
    executeNow({ board, payload }) {
      expectTypeOf(board).toMatchTypeOf<{ x: number }>();
      expectTypeOf(payload).toMatchTypeOf<{ y: string }>();
    },
  };
});

test("todo", () => {
  type GS = GameState<{
    x: number;
  }>;

  type PMT = {
    move: null;
  };

  type BMT = {
    boardMove: null;
  };

  const move: PlayerMove<GS, null, PMT, BMT> = {};
  const boardMove: BoardMove<GS, null, PMT, BMT> = {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    initialBoards: () => ({ board: { x: 0 } }),
    playerMoves: { move },
    boardMoves: { boardMove },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;

  type G = typeof game;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const autoMove: AutoMove<GS, G> = () => {
    return "move";
  };
});

// Sanity checks.
describe("GetPayload", () => {
  test("if game is default, payload is any", () => {
    type G = Game;

    expectTypeOf<GetPayload<G, "patate">>().toBeAny();
  });

  test("if game is defined, payload is correct", () => {
    type GS = GameState<{
      a: number;
    }>;

    const move1: PlayerMove<GS, null> = {
      //
    };

    const move2: PlayerMove<GS, { x: number }> = {
      //
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const game = {
      initialBoards: () => ({ board: { a: 0 } }),
      playerMoves: {
        move1,
        move2,
      },
      minPlayers: 1,
      maxPlayers: 1,
    } satisfies Game<GS>;

    type G = typeof game;

    expectTypeOf<GetPayload<G, "move1">>().toBeNull();
    expectTypeOf<GetPayload<G, "move2">>().toEqualTypeOf<{ x: number }>();
  });
});

test("moves inlined in the game - GS is properly used", () => {
  type GS = GameState<{
    a: number;
  }>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    initialBoards: () => ({ board: { a: 0 } }),
    playerMoves: {
      move: {
        execute({ board }) {
          expectTypeOf(board).toMatchTypeOf<{ a: number }>();
        },
      },
    },
    boardMoves: {
      boardMove: {
        execute({ board }) {
          expectTypeOf(board).toMatchTypeOf<{ a: number }>();
        },
      },
    },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;
});

test("moves inlined in the game with PMT and BMT - they are used", () => {
  type GS = GameState<{
    a: number;
  }>;

  type PMT = {
    move1: null;
    move2: { a: number };
  };

  type BMT = {
    boardMove1: null;
    boardMove2: { a: number };
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    initialBoards: () => ({ board: { a: 0 } }),
    playerMoves: {
      move: {
        execute({ board, delayMove, turns }) {
          expectTypeOf(board).toMatchTypeOf<{ a: number }>();

          delayMove("boardMove1", 1000);

          // @ts-expect-error extra arg
          delayMove("boardMove1", { a: 123 }, 1000);

          // @ts-expect-error missing arg
          delayMove("boardMove2", 1000);

          delayMove("boardMove2", { a: 123 }, 1000);

          turns.begin("userId", {
            expiresIn: 123,
            onExpiration: {
              playerMove: "move1",
            },
          });

          turns.begin("userId", {
            expiresIn: 123,
            onExpiration: {
              // @ts-expect-error missing arg
              playerMove: "move2",
            },
          });

          turns.begin("userId", {
            expiresIn: 123,
            onExpiration: {
              // @ts-expect-error extra arg
              playerMove: ["move1", { a: 123 }],
            },
          });

          turns.begin("userId", {
            expiresIn: 123,
            onExpiration: {
              playerMove: ["move2", { a: 123 }],
            },
          });
        },
      },
    },
    boardMoves: {
      boardMove: {
        execute({ board }) {
          expectTypeOf(board).toMatchTypeOf<{ a: number }>();
        },
      },
    },
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS, PMT, BMT>;
});

test("playerboards is required in initialBoard when PB is defined", () => {
  type GS = GameState<{ a: number }, { b: number }>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    // @ts-expect-error missing payload
    initialBoards: () => ({ board: { a: 0 } }),
    playerMoves: {},
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;
});

test("secretboard is required in initialBoard when SB is defined", () => {
  type GS = GameState<{ a: number }, null, { c: number }>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = {
    // @ts-expect-error missing payload
    initialBoards: () => ({ board: { a: 0 }, playerboard: { b: 0 } }),
    playerMoves: {},
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game2 = {
    initialBoards: () => ({ board: { a: 0 }, secretboard: { c: 0 } }),
    playerMoves: {},
    minPlayers: 1,
    maxPlayers: 1,
  } satisfies Game<GS>;
});
