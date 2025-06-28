import { GamePlayerSettings, GameSettings, UserId } from "@lefun/core";
import {
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

  matchSettings: Record<string, string>;
  matchPlayersSettings: Record<UserId, Record<string, string>>;
};

export type GS = GameState<Board>;

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
  { key: "poil", type: "rank", determinesRank: true },
] as const satisfies GameStats;

type PM<Payload = null> = PlayerMove<
  GS,
  Payload,
  PMT,
  BMT,
  typeof playerStats,
  typeof matchStats
>;

const moveWithArg: PM<MoveWithArgPayload> = {};

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
    const diceValue =
      board.matchPlayersSettings[userId].dieNumFaces === "6"
        ? random.d6()
        : random.dice(20);
    board.players[userId].diceValue = diceValue;
    board.players[userId].isRolling = false;
    board.sum += diceValue;

    delayMove("someBoardMove", 100);
    delayMove("someBoardMoveWithArgs", { someArg: 3 }, 100);

    // Test those types here
    logPlayerStat(userId, "poil", 1);
    logMatchStat("patate", 1);

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

type BM<P = null> = BoardMove<GS, P, PMT, BMT>;

const initMove: BM = {
  execute({ board, turns }) {
    turns.begin(board.playerOrder[0]);
  },
};

const someBoardMove: BM = {
  execute() {
    //
  },
};

const someBoardMoveWithArgs: BM<BoardMoveWithArgPayload> = {
  execute({ board, payload }) {
    board.lastSomeBoardMoveValue = payload.someArg;
  },
};

const gameSettings: GameSettings = [
  {
    key: "setting1",
    options: [{ value: "a" }, { value: "b" }],
  },
  {
    key: "setting2",
    options: [{ value: "x" }, { value: "y", isDefault: true }],
  },
];

const gamePlayerSettings: GamePlayerSettings = [
  {
    key: "color",
    type: "color",
    exclusive: true,
    options: [
      { value: "red", label: "red" },
      { value: "blue", label: "blue" },
      { value: "green", label: "green" },
      { value: "orange", label: "orange" },
      { value: "pink", label: "pink" },
      { value: "brown", label: "brown" },
      { value: "black", label: "black" },
      { value: "darkgreen", label: "darkgreen" },
      { value: "darkred", label: "darkred" },
      { value: "purple", label: "purple" },
    ],
  },
  {
    key: "dieNumFaces",
    type: "string",
    options: [{ value: "6", isDefault: true }, { value: "20" }],
  },
];

export const game = {
  initialBoards({ players, matchSettings, matchPlayersSettings }) {
    return {
      board: {
        sum: 0,
        players: Object.fromEntries(
          players.map((userId) => [userId, { isRolling: false }]),
        ),
        playerOrder: [...players],
        currentPlayerIndex: 0,
        matchSettings,
        matchPlayersSettings,
      },
    };
  },
  playerMoves: { roll, moveWithArg },
  boardMoves: { [INIT_MOVE]: initMove, someBoardMove, someBoardMoveWithArgs },
  minPlayers: 1,
  maxPlayers: 10,
  matchStats,
  playerStats,
  gameSettings,
  gamePlayerSettings,
} satisfies Game<GS, PMT, BMT>;

export type G = typeof game;
