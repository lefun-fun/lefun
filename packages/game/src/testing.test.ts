import { describe, expect, test } from "vitest";

import { Game, GameState, PlayerMove } from ".";
import { MatchTester } from "./testing";

const gameBase = {
  minPlayers: 1,
  maxPlayers: 10,
};

describe("turns", () => {
  type B = { me: number; bot: number; numZeroDelay: number };
  type GS = GameState<B>;
  type P = { itWasMe?: boolean };
  type PMT = Record<string, unknown>;
  // type PMT = {
  //   go: { itWasMe?: boolean };
  //   endTurn: never;
  //   beginZeroDelay: never;
  // };
  type PM<P = never> = PlayerMove<GS, P, PMT>;

  const game = {
    ...gameBase,
    initialBoards: ({ players }) => ({
      board: {
        me: 0,
        bot: 0,
        numZeroDelay: 0,
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

          turns.begin(userId, {
            expiresIn: 1000,
            playerMoveOnExpire: ["go", { itWasMe: false }],
          });
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
          turns.begin(userId, {
            expiresIn: delay,
            playerMoveOnExpire: ["beginWithDelay", { delay: 0 }],
          });
        },
      } as PM<{ delay: number }>,
      move: {
        execute() {
          //
        },
      },
    },
  } satisfies Game<GS>;

  type G = typeof game;

  test("playerMoveOnExpire", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });

    const userId = match.meta.players.allIds[0];

    // I make a move
    match.makeMove(userId, "go", {});

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
    const userId = match.meta.players.allIds[0];
    match.makeMove(userId, "beginWithDelay", { delay: 0 });
    expect(match.board.numZeroDelay).toBe(10);
    expect(match.matchHasEnded).toBe(true);
  });

  test("executes moves with delay 1", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 1 });
    const userId = match.meta.players.allIds[0];
    match.makeMove(userId, "beginWithDelay", { delay: 1 });
    match.fastForward(1);
    expect(match.board.numZeroDelay).toBe(10);
    expect(match.matchHasEnded).toBe(true);
  });

  test("turn ends on move", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 2 });
    const userId = match.meta.players.allIds[0];
    match.makeMove(userId, "go", { itWasMe: true });
    match.makeMove(userId, "move");

    expect(match.meta.players.byId[userId].itsYourTurn).toBe(false);
  });

  test("making a move removes delayed move", () => {
    const match = new MatchTester<GS, G>({ game, numPlayers: 2 });
    const userId = match.meta.players.allIds[0];
    match.makeMove(userId, "go", { itWasMe: true });
    expect(match.delayedMoves.length).toBe(1);
    match.makeMove(userId, "move");
    expect(match.delayedMoves.length).toBe(0);
  });
});
