import { expectTypeOf, test } from "vitest";

import { GameState, PlayerMove } from "./gameDef";

test("PlayerMove - fully-typed", () => {
  type B = {
    x: number;
  };

  type GS = GameState<B>;

  type BMT = {
    boardMove: { payload: string };
  };

  type Payload = { y: string };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payloadMove: PlayerMove<GS, Payload, any, BMT> = {
    executeNow({ board, payload, delayMove }) {
      expectTypeOf(board).toMatchTypeOf<{ x: number }>();
      expectTypeOf(payload).toMatchTypeOf<{ y: string }>();

      // @ts-expect-error missing payload
      expectTypeOf(delayMove).toBeCallableWith("boardMove", 1000);

      // @ts-expect-error wrong name
      expectTypeOf(delayMove).toBeCallableWith("boardMove2", 1000);

      expectTypeOf(delayMove).toBeCallableWith(
        "boardMove",
        { payload: "patate" },
        123,
      );
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
    executeNow({ board, payload, delayMove }) {
      expectTypeOf(board).toMatchTypeOf<{ x: number }>();
      expectTypeOf(payload).toMatchTypeOf<{ y: string }>();

      expectTypeOf(delayMove).toBeCallableWith("boardMove", 1000);
      expectTypeOf(delayMove).toBeCallableWith(
        "boardMove",
        { payload: "patate" },
        123,
      );
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
