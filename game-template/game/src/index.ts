import { UserId } from "@lefun/core";
import {
  GameDef,
  GameState,
  PlayerMoveDef,
  BoardMoveDef,
  definePlayerMove,
  defineBoardMove,
  INIT_MOVE,
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

const [moveWithArgDef, moveWithArg] = definePlayerMove<GS, { someArg: string }>(
  "moveWithArg",
  {
    execute({ board, userId, payload }) {
      // execute content
    },
  },
);

const [rollDef, roll] = definePlayerMove<GS>("roll", {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, playerboards, delayMove }) {
    board.players[userId].diceValue = random.d6();
    board.players[userId].isRolling = false;
    delayMove(someBoardMove(), 100);
    delayMove(someBoardMoveWithArgs({ someArg: 3 }), 100);
  },
});

const [initMoveDef] = defineBoardMove<GS>(INIT_MOVE, {
  execute({ board }) {
    //
  },
});

const [someBoardMoveDef, someBoardMove] = defineBoardMove<GS>("someboardMove", {
  execute({ board }) {
    //
  },
});

const [someBoardMoveWithArgsDef, someBoardMoveWithArgs] = defineBoardMove<
  GS,
  { someArg: number }
>("someboardMoveWithArgs", {
  execute({ board, payload }) {
    //
  },
});

const game = {
  initialBoards: ({ players }) => ({
    board: {
      count: 0,
      players: Object.fromEntries(
        players.map((userId) => [userId, { isRolling: false }]),
      ),
    },
  }),
  playerMoves: {
    ...rollDef,
    ...moveWithArgDef,
  },
  boardMoves: {
    ...initMoveDef,
    ...someBoardMoveDef,
    ...someBoardMoveWithArgsDef,
  },
  minPlayers: 1,
  maxPlayers: 10,
} satisfies GameDef<GS>;

export { GS, game, roll, moveWithArg };
