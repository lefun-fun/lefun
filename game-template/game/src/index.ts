import { UserId } from "@lefun/core";
import { BoardMoveDef, GameDef, GameState, PlayerMoveDef } from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  count: number;
  players: Record<UserId, Player>;
};

type GS = GameState<Board>;

type BMT = {
  someBoardMove: never;
  someBoardMoveWithArgs: { someArg: number };
};

const moveWithArg = {
  execute() {
    //
  },
} satisfies PlayerMoveDef<GS, { someArg: string }, BMT>;

const roll = {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, delayMove }) {
    board.players[userId].diceValue = random.d6();
    board.players[userId].isRolling = false;
    delayMove("someBoardMove", 100);
    delayMove("someBoardMoveWithArgs", { someArg: 3 }, 100);
  },
} satisfies PlayerMoveDef<GS, never, BMT>;

const initMove_ = {
  execute() {
    //
  },
} satisfies BoardMoveDef<GS, never, BMT>;

const someBoardMove = {
  execute() {
    //
  },
} satisfies BoardMoveDef<GS, never, BMT>;

const someBoardMoveWithArgs = {
  execute() {
    //
  },
} satisfies BoardMoveDef<GS, BMT["someBoardMoveWithArgs"], BMT>;

const game = {
  initialBoards: ({ players }) => ({
    board: {
      count: 0,
      players: Object.fromEntries(
        players.map((userId) => [userId, { isRolling: false }]),
      ),
    },
  }),
  playerMoves: { roll, moveWithArg },
  boardMoves: { initMove_, someBoardMove, someBoardMoveWithArgs },
  minPlayers: 1,
  maxPlayers: 10,
} satisfies GameDef<GS, BMT>;

type Game = typeof game;

export { Game, game, GS };
