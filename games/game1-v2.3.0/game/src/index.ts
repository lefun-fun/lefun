import { UserId } from "@lefun/core";
import {
  AutoMove,
  BoardMove,
  Game,
  GameState,
  GameStats,
  INIT_MOVE,
  PlayerMove,
} from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
};

export type Board = {
  players: Record<UserId, Player>;
  playerOrder: UserId[];
  currentPlayerIndex: number;

  sum: number;
  lastSomeBoardMoveValue?: number;
};

export type RollGameState = GameState<Board>;

type MoveWithArgPayload = { someArg: string };
type BoardMoveWithArgPayload = { someArg: number };

export type PMT = {
  roll: null;
  moveWithArg: MoveWithArgPayload;
};

export type BMT = {
  someBoardMove: null;
  someBoardMoveWithArgs: BoardMoveWithArgPayload;
};

const matchStats = [
  { key: "patate", type: "integer" },
] as const satisfies GameStats;

const playerStats = [
  { key: "poil", type: "rank", primary: true },
] as const satisfies GameStats;

type PM<Payload = null> = PlayerMove<
  RollGameState,
  Payload,
  PMT,
  BMT,
  typeof matchStats,
  typeof playerStats
>;

const moveWithArg: PM<MoveWithArgPayload> = {
  execute({ turns, userId }) {
    console.log("turns", turns.isTurn(userId));
    if (turns.isTurn(userId)) {
      turns.begin(userId);
    }
  },
};

const roll: PM = {
  executeNow({ board, userId }) {
    board.players[userId].isRolling = true;
  },
  execute({
    board,
    userId,
    random,
    delayMove,
    turns,
    logMatchStat,
    logPlayerStat,
    endMatch,
  }) {
    const diceValue = random.d6();
    board.players[userId].diceValue = diceValue;
    board.players[userId].isRolling = false;
    board.sum += diceValue;

    delayMove("someBoardMove", 100);
    delayMove("someBoardMoveWithArgs", { someArg: 3 }, 100);

    // Test those types here
    logPlayerStat(userId, "patate", 1);
    logMatchStat("poil", 1);

    // If it was the player's turn, we go to the next player.
    if (userId === board.playerOrder[board.currentPlayerIndex]) {
      turns.end(userId);
      board.currentPlayerIndex =
        (board.currentPlayerIndex + 1) % board.playerOrder.length;
      const nextPlayer = board.playerOrder[board.currentPlayerIndex];

      turns.begin(nextPlayer, {
        expiresIn: 60000,
        playerMoveOnExpire: ["moveWithArg", { someArg: "0" }],
      });
    }

    if (board.sum >= 20) {
      endMatch();
    }
  },
};

const initMove: BoardMove<RollGameState, null> = {
  execute({ board, turns }) {
    turns.begin(board.playerOrder[0]);
  },
};

const someBoardMove: BoardMove<RollGameState, null> = {
  execute() {
    //
  },
};

const someBoardMoveWithArgs: BoardMove<RollGameState, BoardMoveWithArgPayload> =
  {
    execute({ board, payload }) {
      board.lastSomeBoardMoveValue = payload.someArg;
    },
  };

export const game = {
  version: "2.3.0",
  initialBoards({ players }) {
    const playerOrder = [...players];

    return {
      board: {
        sum: 0,
        players: Object.fromEntries(
          players.map((userId) => [userId, { isRolling: false }]),
        ),
        playerOrder,
        currentPlayerIndex: 0,
      },
    };
  },
  playerMoves: { roll, moveWithArg },
  boardMoves: { [INIT_MOVE]: initMove, someBoardMove, someBoardMoveWithArgs },
  minPlayers: 1,
  maxPlayers: 10,
  matchStats,
  playerStats,
} satisfies Game<RollGameState, PMT, BMT>;

export const autoMove: AutoMove<RollGameState, RollGame> = ({ random }) => {
  if (random.d2() === 1) {
    return ["moveWithArg", { someArg: "123" }];
  }
  return "roll";
};

export type RollGame = typeof game;
