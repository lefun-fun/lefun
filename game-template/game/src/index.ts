import { UserId } from "@lefun/core";
import {
  // createMove,
  GameDef,
  GameMove,
  GameMoves,
  PlayerMove,
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

type GS = {
  B: Board;
  PB: EmptyObject;
  SB: EmptyObject;
};

const roll = {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, payload, playerboards }) {
    board.players[userId].diceValue = random.d6();
    board.players[userId].isRolling = false;
  },
} satisfies PlayerMove<GS, EmptyObject>;

type Payload = { someArg: number };

const moveWithArg = {
  execute({ board, userId, payload }) {
    //
  },
} satisfies PlayerMove<GS, Payload>;

const moves = {
  roll,
  moveWithArg,
} satisfies GameMoves<GS>;

// type RollGameDef = GameDef<G, typeof moves>;

type GM = typeof moves;

const game = {
  initialBoards: ({ players }) => ({
    board: {
      count: 0,
      players: Object.fromEntries(
        players.map((userId) => [userId, { isRolling: false }]),
      ),
    },
  }),
  moves,
  minPlayers: 1,
  maxPlayers: 10,
} satisfies GameDef<GS, GM>;

// const move = {
//   name: "moveWithArg",
//   payload: { someArg: 123 },
// } satisfies GameMove<GS, GM>;

// const move2 = {
//   name: "roll",
//   payload: { someArg: 123 },
// } satisfies GameMove<GS, GM>;

export { GS, GM, roll, game };
