import { UserId } from "@lefun/core";
import { BoardMove, Game, GameState, INIT_MOVE, PlayerMove } from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  count: number;
  players: Record<UserId, Player>;
};

export type RollGameState = GameState<Board>;

type BMT = {
  someBoardMove: never;
  someBoardMoveWithArgs: { someArg: number };
};

const moveWithArg: PlayerMove<RollGameState, { someArg: string }, BMT> = {
  execute() {
    //
  },
};

const roll: PlayerMove<RollGameState, never, BMT> = {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, delayMove }) {
    board.players[userId].diceValue = random.d6();
    board.players[userId].isRolling = false;
    delayMove("someBoardMove", 100);
    delayMove("someBoardMoveWithArgs", { someArg: 3 }, 100);
  },
};

const initMove: BoardMove<RollGameState, never, BMT> = {
  execute() {
    //
  },
};

const someBoardMove: BoardMove<RollGameState, never, BMT> = {
  execute() {
    //
  },
};

const someBoardMoveWithArgs: BoardMove<
  RollGameState,
  BMT["someBoardMoveWithArgs"],
  BMT
> = {
  execute() {
    //
  },
};

export const game = {
  initialBoards: ({ players }) => ({
    board: {
      count: 0,
      players: Object.fromEntries(
        players.map((userId) => [userId, { isRolling: false }]),
      ),
    },
  }),
  playerMoves: { roll, moveWithArg },
  boardMoves: { [INIT_MOVE]: initMove, someBoardMove, someBoardMoveWithArgs },
  minPlayers: 1,
  maxPlayers: 10,
} satisfies Game<RollGameState, BMT>;

export type RollGame = typeof game;
