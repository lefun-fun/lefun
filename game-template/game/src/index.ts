import { UserId } from "@lefun/core";
import { createMove, GameDef, Moves } from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  count: number;
  players: Record<UserId, Player>;
};

const [ROLL, roll] = createMove("roll");

const moves: Moves<Board> = {
  [ROLL]: {
    executeNow({ board, userId }) {
      board.players[userId].isRolling = true;
    },
    execute({ board, userId, random }) {
      board.players[userId].diceValue = random.d6();
      board.players[userId].isRolling = false;
    },
  },
};

const game: GameDef<Board> = {
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
};

export { game, roll };
