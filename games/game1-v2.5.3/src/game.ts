import { GamePlayerSettings, GameSettings, UserId } from "@lefun/core";
import {
  BoardMove,
  Game,
  GameState,
  GameStats,
  INIT_MOVE,
  PlayerMove,
  Turns,
} from "@lefun/game";

type Player = {
  isRolling: boolean;
  diceValue?: number;
  expiresAt?: number;
  isDead: boolean;
};

export type B = {
  players: Record<UserId, Player>;
  playerOrder: UserId[];
  currentPlayerIndex: number;

  sum: number;

  matchSettings: Record<string, string>;
  matchPlayersSettings: Record<UserId, Record<string, string>>;

  endsAt: number | null;
};

export type GS = GameState<B>;

type KillPayload = { userId: UserId };

export type PMT = {
  roll: null;
  pass: null;
};

export type BMT = {
  kill: KillPayload;
  endMatch: null;
};

const matchStats = [
  { key: "sumOnEnd", type: "integer" },
] as const satisfies GameStats;

const playerStats = [
  {
    key: "iMadeTheLastRoll",
    type: "boolean",
    determinesRank: true,
    ordering: "lowerIsBetter",
  },
  { key: "rollValue", type: "integer", determinesRank: true },
] as const satisfies GameStats;

type PM<Payload = null> = PlayerMove<
  GS,
  Payload,
  PMT,
  BMT,
  typeof playerStats,
  typeof matchStats
>;

export const getCurrentPlayer = (board: B) => {
  const { currentPlayerIndex, playerOrder } = board;
  return playerOrder[currentPlayerIndex];
};

export const TURN_DURATION = 3000;
export const MATCH_DURATION = 10_000;

const goToNextPlayerNow = ({
  board,
  turns,
}: {
  board: B;
  turns: Turns<PMT, BMT>;
}) => {
  const { playerOrder, currentPlayerIndex } = board;

  turns.end(getCurrentPlayer(board));

  let nextPlayerIndex = currentPlayerIndex;
  let nextPlayer = playerOrder[currentPlayerIndex];

  for (const _ of playerOrder) {
    nextPlayerIndex = (nextPlayerIndex + 1) % playerOrder.length;
    nextPlayer = playerOrder[nextPlayerIndex];
    if (!board.players[nextPlayer].isDead) {
      break;
    }
  }

  board.currentPlayerIndex = nextPlayerIndex;

  turns.begin(nextPlayer, {
    expiresIn: TURN_DURATION,
    boardMoveOnExpire: ["kill", { userId: nextPlayer }],
  });
};

const goToNextPlayer = ({ board, ts }: { board: B; ts: number }) => {
  const nextPlayer = getCurrentPlayer(board);
  board.players[nextPlayer].expiresAt = ts + TURN_DURATION;
};

const pass: PM = {
  executeNow({ board, turns }) {
    goToNextPlayerNow({ board, turns });
  },
  execute({ board, ts }) {
    goToNextPlayer({ board, ts });
  },
};

const roll: PM = {
  executeNow({ board, userId }) {
    if (getCurrentPlayer(board) !== userId) {
      throw new Error("not your turn!");
    }
    board.players[userId].isRolling = true;
  },
  execute({ board, userId, random, ts, turns, _ }) {
    board.players[userId].isRolling = false;

    const diceValue =
      board.matchPlayersSettings[userId].dieNumFaces === "6"
        ? random.d6()
        : random.dice(20);

    board.players[userId].diceValue = diceValue;
    board.sum = Object.values(board.players).reduce(
      (sum, player) => sum + (player.diceValue || 0),
      0,
    );

    // Test those types here
    _.logPlayerStat(userId, "rollValue", diceValue);

    // If it was the player's turn, we go to the next player.
    goToNextPlayerNow({ board, turns });
    goToNextPlayer({ board, ts });

    if (board.sum >= 20) {
      _.endMatch();
      _.logMatchStat("sumOnEnd", board.sum);
      _.logPlayerStat(userId, "iMadeTheLastRoll", 1);
    }
  },
};

const kill: BoardMove<GS, KillPayload, PMT, BMT> = {
  execute({ board, payload, _, turns, ts }) {
    const { userId } = payload;
    board.players[userId].diceValue = undefined;
    board.players[userId].isDead = true;
    goToNextPlayerNow({ board, turns });
    goToNextPlayer({ board, ts });

    if (Object.values(board.players).every((p) => p.isDead)) {
      _.endMatch();
    }
  },
};

type BM<P = null> = BoardMove<GS, P, PMT, BMT>;

const initMove: BM = {
  execute({ board, _, ts }) {
    _.turns.begin(board.playerOrder[0]);
    _.delayMove("endMatch", MATCH_DURATION);
    board.endsAt = ts + MATCH_DURATION;
  },
};

const endMatch: BM = {
  execute({ board, _ }) {
    for (const userId of board.playerOrder) {
      board.players[userId].expiresAt = undefined;
      board.players[userId].isDead = true;
    }

    _.endMatch();
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
          players.map((userId) => [
            userId,
            { isRolling: false, isDead: false },
          ]),
        ),
        playerOrder: [...players],
        currentPlayerIndex: 0,
        matchSettings,
        matchPlayersSettings,
        endsAt: null,
      },
    };
  },
  playerMoves: { roll, pass },
  boardMoves: { [INIT_MOVE]: initMove, kill, endMatch },
  minPlayers: 1,
  maxPlayers: 10,
  matchStats,
  playerStats,
  gameSettings,
  gamePlayerSettings,
} satisfies Game<GS, PMT, BMT>;

export type G = typeof game;
