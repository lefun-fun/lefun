import { UserId } from "@lefun/core";
import {
  makeGameDef,
  GameDef,
  GameState,
  PlayerMoveDef,
  BoardMoveDefs,
} from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  count: number;
  players: Record<UserId, Player>;
};

type EmptyObject = Record<string, never>;

type GS = GameState<Board>;

type BoardMoveTypes = {
  _initMove: EmptyObject;
  someBoardMove: EmptyObject;
  someBoardMoveWithArgs: { someArg: number };
};

const moveWithArg = {
  execute({ board, userId, payload, delayMove }) {
    // execute content
  },
} satisfies PlayerMoveDef<GS, BoardMoveTypes, { someArg: string }>;

const roll = {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, playerboards, delayMove }) {
    board.players[userId].diceValue = random.d6();
    board.players[userId].isRolling = false;
    delayMove({ name: "someBoardMove" }, 100);
    delayMove({ name: "someBoardMoveWithArgs", payload: { someArg: 3 } }, 100);
  },
} satisfies PlayerMoveDef<GS, BoardMoveTypes>;

const playerMoves = {
  moveWithArg,
  roll,
};

type PM = typeof playerMoves;

const boardMoves = {
  _initMove: {
    execute({ board }) {
      //
    },
  },
  someBoardMove: {
    execute({ board }) {
      //
    },
  },
  someBoardMoveWithArgs: {
    execute({ board, payload }) {
      //
    },
  },
} satisfies BoardMoveDefs<GS, BoardMoveTypes>;

const game = {
  initialBoards: ({ players }) => ({
    board: {
      count: 0,
      players: Object.fromEntries(
        players.map((userId) => [userId, { isRolling: false }]),
      ),
    },
  }),
  playerMoves,
  boardMoves,
  minPlayers: 1,
  maxPlayers: 10,
} satisfies GameDef<GS, PM, typeof boardMoves, BoardMoveTypes>;

export { GS, PM, game };
