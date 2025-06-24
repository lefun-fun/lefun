import { UserId } from "@lefun/core";
import {
  AutoMove,
  BoardMove,
  Game,
  GameState,
  INIT_MOVE,
  PlayerMove,
} from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  count: number;
  players: Record<UserId, Player>;
  lastSomeBoardMoveValue?: number;
};

export type RollGameState = GameState<Board>;

type BMT = {
  someBoardMove: never;
  someBoardMoveWithArgs: { someArg: number };
};

// type PMT = any;

// const moveWithArg: PlayerMove<RollGameState, { someArg: string }, PMT, BMT> = {
const moveWithArg: any = {
  execute({ itsYourTurn, userId }: any) {
    itsYourTurn({ userIds: [userId], overUserIds: [] });
  },
};

const roll: PlayerMove<RollGameState, never> = {
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

const initMove: BoardMove<RollGameState, never> = {
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
  execute({ board, payload }) {
    board.lastSomeBoardMoveValue = payload.someArg;
  },
};

export const game = {
  version: "2.2.0",
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
  playerScoreType: "integer",
  matchScoreType: "integer",
} satisfies Game<RollGameState>;

export const autoMove: AutoMove<RollGameState, RollGame> = ({ random }) => {
  if (random.d2() === 1) {
    return ["moveWithArg", { someArg: "123" }];
  }
  return "roll";
};

export type RollGame = typeof game;
