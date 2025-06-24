import type { GameStatType, UserId } from "@lefun/core";

import type {
  Execute,
  ExecuteNow,
  Game,
  GameStats,
  PlayerMove,
} from "./gameDef";

export function v2_2_0_to_v2_3_0(
  game: Game & {
    playerScoreType?: GameStatType;
    matchScoreType?: GameStatType;
  },
): Game {
  // Moves
  const fixExecute: any =
    (execute: Execute | ExecuteNow) =>
    ({ endMatch, logPlayerStat, logMatchStat, turns, ...rest }: any) => {
      const endMatch2_2_0 = ({
        score,
        scores = {},
      }: {
        score: any;
        scores: Record<UserId, number>;
      }) => {
        logMatchStat("score", score);
        for (const [userId, score] of Object.entries(scores)) {
          logPlayerStat(userId, "score", score);
        }
        endMatch();
      };

      const itsYourTurn = ({
        userIds,
        overUserIds,
      }: {
        userIds: UserId[];
        overUserIds: UserId[];
      }) => {
        turns.begin(userIds);
        turns.end(overUserIds);
      };

      return execute({ endMatch: endMatch2_2_0, itsYourTurn, ...rest });
    };

  const playerMoves: Record<string, PlayerMove> = Object.fromEntries(
    Object.entries(game.playerMoves).map(
      ([moveName, { canDo, execute, executeNow }]) => [
        moveName,
        {
          canDo,
          execute: fixExecute(execute),
          executeNow: fixExecute(executeNow),
        },
      ],
    ),
  );

  // Scores -> stats
  let playerStats: GameStats | undefined = undefined;
  const matchStats: GameStats | undefined = undefined;

  if (game.playerScoreType) {
    playerStats = [
      { key: "score", type: game.playerScoreType, determinesRank: true },
    ];
  }

  if (game.matchScoreType) {
    playerStats = [
      { key: "score", type: game.matchScoreType, determinesRank: true },
    ];
  }

  return { ...game, playerMoves, playerStats, matchStats };
}

export function migrateGame(game: Game): Game {
  // FIXME
  // if (game.version === undefined) {
  //   return v2_2_0_to_v2_3_0(game);
  // }

  // if (game.version !== "2.3.0") {
  //   throw new Error(`invalid game version ${game.version}`);
  // }

  return game;
}
