import { describe, expect, test } from "vitest";

import { GamePlayerSettings } from "@lefun/core";

import { BoardMove, Game, GameState, INIT_MOVE, PlayerMove } from ".";
import { MatchTester } from "./testing";

const gameBase = {
  minPlayers: 1,
  maxPlayers: 10,
};

describe("turns", () => {
  type B = {
    me: number;
    bot: number;
    numZeroDelay: number;
    expiresAt: number | undefined;
  };
  type GS = GameState<B>;
  type P = { itWasMe?: boolean };
  type PM<P = null> = PlayerMove<GS, P>;

  const game = {
    ...gameBase,
    initialBoards: ({ players }) => ({
      board: {
        me: 0,
        bot: 0,
        numZeroDelay: 0,
        expiresAt: undefined,
      },
      itsTheirTurn: players,
    }),
    playerMoves: {
      go: {
        execute({ userId, board, payload, turns }) {
          if (payload.itWasMe ?? true) {
            board.me++;
          } else {
            board.bot++;
          }

          const { expiresAt } = turns.begin(userId, {
            expiresIn: 1000,
            playerMoveOnExpire: ["go", { itWasMe: false }],
          });
          board.expiresAt = expiresAt;
        },
      } as PM<P>,
      endTurn: {
        execute({ userId, turns }) {
          turns.end(userId);
        },
      } as PM,
      beginWithDelay: {
        execute({ board, userId, turns, endMatch, payload }) {
          const { delay } = payload;
          board.numZeroDelay++;
          if (board.numZeroDelay >= 10) {
            endMatch();
            return;
          }
          const { expiresAt } = turns.begin(userId, {
            expiresIn: delay,
            playerMoveOnExpire: ["beginWithDelay", { delay: 0 }],
          });
          board.expiresAt = expiresAt;
        },
      } as PM<{ delay: number }>,
      move: {
        execute() {
          //
        },
      } as PM,
    },
  } satisfies Game<GS>;

  type G = typeof game;

  test("playerMoveOnExpire", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });

    const userId = match.meta.players.allIds[0]!;
    expect(match.board.expiresAt).toBe(undefined);

    // I make a move
    match.makeMove(userId, "go", {});
    expect(match.board.expiresAt).toEqual(1000);

    // Auto move 1 second later
    match.fastForward(1000);

    expect(match.board.me).toBe(1);
    expect(match.board.bot).toBe(1);

    // Other automove 1 second later
    match.fastForward(1000);

    expect(match.board.me).toBe(1);
    expect(match.board.bot).toBe(2);

    // I move before the auto-move. The timer resets.
    match.fastForward(500);
    match.makeMove(userId, "go", {});

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(2);

    // So this is not enough.
    match.fastForward(500);

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(2);

    // Auto move triggered 1s after the last move.
    match.fastForward(500);

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(3);

    match.fastForward(1000);

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(4);

    // Finally test that if we simply end the player's turn, the timers reset.
    match.fastForward(500);
    match.makeMove(userId, "endTurn");

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(4);

    match.fastForward(8000);

    expect(match.board.me).toBe(2);
    expect(match.board.bot).toBe(4);
  });

  test("executes moves with delay 0 right away", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });
    const userId = match.meta.players.allIds[0]!;
    match.makeMove(userId, "beginWithDelay", { delay: 0 });
    expect(match.board.numZeroDelay).toBe(10);
    expect(match.matchHasEnded).toBe(true);
  });

  test("executes moves with delay 1", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });
    const userId = match.meta.players.allIds[0]!;
    match.makeMove(userId, "beginWithDelay", { delay: 1 });
    match.fastForward(1);
    expect(match.board.numZeroDelay).toBe(10);
    expect(match.matchHasEnded).toBe(true);
  });

  test("expiresAt", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });

    const userId = match.meta.players.allIds[0]!;
    expect(match.board.expiresAt).toBe(undefined);

    match.makeMove(userId, "go", {});
    expect(match.board.expiresAt).toEqual(1000);
  });

  test("double begin turn: only the latest counts", () => {
    type B = {
      x: string;
    };
    type GS = GameState<B>;
    const game = {
      ...gameBase,
      initialBoards: () => ({ board: { x: "" } }),
      playerMoves: {
        add: {
          executeNow({ board, payload }) {
            board.x += payload.x;
          },
        } as PlayerMove<GS, { x: string }>,
        begin: {
          execute({ userId, payload, _ }) {
            _.turns.begin(userId, {
              expiresIn: 10,
              playerMoveOnExpire: ["add", { x: payload.onExpire }],
            });
          },
        } as PlayerMove<GS, { onExpire: string }>,
      },
    } satisfies Game<GS>;

    const match = new MatchTester<GS, typeof game>({ game, numPlayers: 1 });
    const userId = match.meta.players.allIds[0]!;
    match.makeMove(userId, "begin", { onExpire: "a" });
    expect(match.board.x).toBe("");
    match.fastForward(10);
    expect(match.board.x).toBe("a");

    match.makeMove(userId, "begin", { onExpire: "b" });
    match.makeMove(userId, "begin", { onExpire: "c" });
    match.fastForward(20);
    expect(match.board.x).toBe("ac");
  });
});

describe("fastForward", () => {
  test("fastForward takes into account the time of triggering", () => {
    // Let's say we fastFoward(10 seconds), but at 5 seconds something would trigger
    // Something 1 second later, it has to execute at 6 seconds.
    type B = {
      timestamps: number[];
    };
    type GS = GameState<B>;
    const game = {
      ...gameBase,
      initialBoards: () => ({ board: { timestamps: [] } }),
      playerMoves: {},
      boardMoves: {
        [INIT_MOVE]: {
          execute({ delayMove }) {
            delayMove("move", 0);
          },
        },
        move: {
          execute({ board, ts, delayMove }) {
            board.timestamps.push(ts);
            if (board.timestamps.length <= 3) {
              delayMove("move", 1000);
            }
          },
        } satisfies BoardMove<GS, null>,
      },
    } satisfies Game<GS>;

    const match = new MatchTester<GS, typeof game>({ game, numPlayers: 1 });

    match.fastForward(5000);
    expect(match.board.timestamps).toEqual([0, 1000, 2000, 3000]);
  });

  test("add move in reverse order", () => {
    type B = {
      timestamps: number[];
    };
    type GS = GameState<B>;
    const game = {
      ...gameBase,
      initialBoards: () => ({ board: { timestamps: [] } }),
      playerMoves: {},
      boardMoves: {
        [INIT_MOVE]: {
          execute({ delayMove }) {
            delayMove("move", 1000);
            delayMove("move", 0);
          },
        },
        move: {
          execute({ board, ts }) {
            board.timestamps.push(ts);
          },
        } satisfies BoardMove<GS, null>,
      },
    } satisfies Game<GS>;

    const match = new MatchTester<GS, typeof game>({ game, numPlayers: 1 });

    match.fastForward(5000);
    expect(match.board.timestamps).toEqual([0, 1000]);
  });
});

describe("game player settings", () => {
  test("game player settings default settings are correct", () => {
    type B = {
      matchPlayersSettings: Record<string, Record<string, string>>;
    };
    type GS = GameState<B>;

    const gamePlayerSettings: GamePlayerSettings = [
      {
        key: "color",
        type: "color",
        options: [
          {
            value: "red",
            label: "red",
          },
          {
            value: "blue",
            label: "red",
          },
        ],
        exclusive: true,
      },
    ];

    const game = {
      ...gameBase,
      initialBoards: ({ matchPlayersSettings }) => ({
        board: { matchPlayersSettings },
      }),
      playerMoves: {},
      boardMoves: {},
      gamePlayerSettings,
    } satisfies Game<GS>;

    const match = new MatchTester<GS, typeof game>({ game, numPlayers: 2 });

    expect(match.matchPlayersSettings).toEqual({
      "userId-0": {
        color: "red",
      },
      "userId-1": {
        color: "blue",
      },
    });
  });
});

test("error in move does not get applied", () => {
  type B = {
    x: number;
  };
  type GS = GameState<B>;
  const game = {
    ...gameBase,
    initialBoards: () => ({ board: { x: 0 } }),
    playerMoves: {
      incrementWithError: {
        execute({ board }) {
          board.x++;
          throw new Error("error");
        },
      },
    },
  } satisfies Game<GS>;

  const match = new MatchTester<GS, typeof game>({ game, numPlayers: 1 });

  const userId = match.meta.players.allIds[0]!;

  expect(() => {
    match.makeMove(userId, "incrementWithError");
  }).toThrowError("error");

  expect(match.board.x).toBe(0);
});

test("canFail", () => {
  type B = {
    x: number;
  };
  type GS = GameState<B>;
  const game = {
    ...gameBase,
    initialBoards: () => ({ board: { x: 0 } }),
    playerMoves: {
      go: {
        execute({ board }) {
          board.x++;
          throw new Error("error");
        },
      } as PlayerMove<GS, null>,
    },
  } satisfies Game<GS>;

  const match = new MatchTester<GS, typeof game>({ game, numPlayers: 1 });

  const userId = match.meta.players.allIds[0]!;

  match.makeMove(userId, "go", null, { canFail: true });

  expect(() => {
    match.makeMove(userId, "go", null, { canFail: false });
  }).toThrowError("error");

  expect(match.board.x).toBe(0);
});

test("end match ends turns", () => {
  const game = {
    ...gameBase,
    initialBoards: () => ({ board: { x: 0 } }),
    playerMoves: {
      go: {
        execute({ userId, _ }) {
          _.turns.begin(userId);
          _.endMatch();
        },
      },
    },
  } satisfies Game;

  const match = new MatchTester({ game, numPlayers: 1 });
  const userId = match.meta.players.allIds[0]!;
  match.makeMove(userId, "go");
  expect(match.matchHasEnded).toBe(true);
  expect(match.meta.players.byId[userId]?.itsYourTurn).toBe(false);
});
