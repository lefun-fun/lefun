import {
  AkaType,
  Credits,
  EndMatchOptions,
  GamePlayerSettings,
  GameSettings,
  GameStats,
  ItsYourTurnPayload,
  Locale,
  MatchPlayerSettings,
  MatchPlayersSettings,
  MatchSettings,
  Move,
  ScoreType,
  UserId,
} from "@lefun/core";

import { Random } from "./random";

type EmptyObject = Record<string, never>;

// We provide a default payload for when we don't need one (for example for moves
// without any options). This has the side effect of allowing for a missing
// payload when one should be required.
export const createMove = <P = EmptyObject>(
  name: string,
): [string, (payload?: P) => Move<P>] => {
  const f = (payload: P = {} as any) => {
    return { name, payload };
  };
  return [name, f];
};

export const DELAYED_MOVE = "lefun/delayedMove";

/*
 * Construct a delayed move "action"
 */
export const delayedMove = <P>(
  move: Move<P>,
  // Timestamp (using something like `new Date().getTime()`)
  ts: number,
): DelayedMove<P> => {
  return {
    type: DELAYED_MOVE,
    ts,
    move,
  };
};

export type DelayedMove<P = unknown> = {
  type: typeof DELAYED_MOVE;
  // Time at which we want the move to be executed.
  ts: number;
  // The update itself.
  move: Move<P>;
};

export type RewardPayload = {
  rewards: Record<UserId, number>;
  stats?: Record<UserId, Record<string, number>>;
};

export type SpecialFuncs = {
  delayMove: (move: Move<unknown>, delay: number) => { ts: number };
  itsYourTurn: (arg0: ItsYourTurnPayload) => void;
  endMatch: (arg0?: EndMatchOptions) => void;
  reward?: (options: RewardPayload) => void;
  logStat: (key: string, value: number) => void;
};

type ExecuteNowOptions<B, PB, P = unknown> = {
  userId: UserId;
  board: B;
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: PB;
  payload: P;
  delayMove: SpecialFuncs["delayMove"];
};

export type ExecuteNow<B, PB, P = unknown> = (
  options: ExecuteNowOptions<B, PB, P>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<B, PB, SB, P = unknown> = {
  userId: UserId;
  board: B;
  // Even though `playerboards` and `secretboard` are optional, we'll assume that the
  // game developer has defined them if they use them if their execute* functions!
  playerboards: Record<UserId, PB>;
  secretboard: SB;
  payload: P;
  random: Random;
  ts: number;
  gameData: any;
  matchData?: any;
} & SpecialFuncs;

export type Execute<B, PB, SB, P = unknown> = (
  options: ExecuteOptions<B, PB, SB, P>,
) => void;

export type PlayerMove<B, PB, SB, P> = {
  canDo?: (options: {
    userId: UserId;
    board: B;
    playerboard: PB;
    payload: P;
    // We'll pass `null` on the client, where we don't have the server time.
    ts: number | null;
  }) => boolean;
  executeNow?: ExecuteNow<B, PB, P>;
  execute?: Execute<B, PB, SB, P>;
};

export type BoardExecute<B, PB, SB, P = unknown> = (
  options: Omit<ExecuteOptions<B, PB, SB, P>, "userId">,
) => void;

export type BoardMove<B, PB, SB, P> = {
  execute?: BoardExecute<B, PB, SB, P>;
};

export type Moves<B, PB = EmptyObject, SB = EmptyObject> = Record<
  string,
  PlayerMove<B, PB, SB, any>
>;

export type BoardMoves<B, PB = EmptyObject, SB = EmptyObject> = Record<
  string,
  BoardMove<B, PB, SB, any>
>;

export type InitialBoardsOptions<B> = {
  players: UserId[];
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;
  random: Random;
  previousBoard?: B;
  areBots: Record<UserId, boolean>;
  gameData: any;
  matchData?: any;
  // Locale used when creating the board.
  // This is used occasionnaly for games with localized data where we don't want to
  // add an gameSetting.
  locale: Locale;
};

export type InitialPlayerboardOptions<B, PB, SB> = {
  userId: UserId;
  board: B;
  secretboard: SB;
  // Those are the playerboards for the *other* players.
  playerboards: Record<UserId, PB>;
  random: Random;
  gameData: any;
  matchData?: any;
};

/*
 * Object that `autoMove` can return to help train reinforcement learning models.
 */
export type AutoMoveInfo = {
  // Who does the action.
  userId: UserId;
  numActions: number;
  // All the vectors for all their possible actions.
  actionFeatures: Record<
    string,
    {
      // We encode the data in base64
      data: string;
      shape: number[];
    }
  >;
  // Features representing the state.
  stateFeatures: Record<
    string,
    {
      // We encode the data in base64
      data: string;
      shape: number[];
    }
  >;
  // The action they chose.
  chosenAction: number;
  // Probabilities tha we had for each action. Currently this is only used for debugging purposes.
  // probs: number[];
  stringRepr?: string;
  // How much time did it take to compute the move.
  time?: number;
};

export type AutoMoveRet<P = unknown> =
  | {
      move: Move<P>;
      duration?: number;
    }
  | Move<P>;

type AutoMoveType<B, PB, SB, P = unknown> = (arg0: {
  userId: UserId;
  board: B;
  playerboard: PB;
  secretboard: SB;
  random: Random;
  returnAutoMoveInfo: boolean;
}) => AutoMoveRet<P>;

type GetAgent<B, PB> = (arg0: {
  matchSettings: MatchSettings;
  matchPlayerSettings: MatchPlayerSettings;
  numPlayers: number;
}) => Promise<Agent<B, PB>>;

export type AgentGetMoveRet<P = unknown> = {
  // The `move` that should be performed.
  move: Move<P>;
  // Some info used for training.
  autoMoveInfo?: AutoMoveInfo;
  // How much "thinking time" should be pretend this move took.
  // After having calculated our move, we'll wait the difference before actually
  // executing the move so that it takes that much time.
  duration?: number;
};

export abstract class Agent<B, PB = EmptyObject> {
  abstract getMove({
    board,
    playerboard,
    random,
    userId,
    withInfo,
    verbose,
  }: {
    board: B;
    playerboard: PB;
    random: Random;
    userId: UserId;
    withInfo: boolean;
    verbose?: boolean;
  }): Promise<AgentGetMoveRet>;
}

export type GetMatchScoreTextOptions<B> = {
  board: B;
};

// This is what the game developer must implement.
export type GameDef<B, PB = EmptyObject, SB = EmptyObject> = {
  initialBoards: (options: InitialBoardsOptions<B>) => {
    board: B;
    playerboards?: Record<UserId, PB>;
    secretboard?: SB;
    itsYourTurnUsers?: UserId[];
  };
  // There is a separate function for the `playerboard` for games that support adding a
  // player into an ongoing match.
  initialPlayerboard?: (options: InitialPlayerboardOptions<B, PB, SB>) => PB;

  // For those the key is the `name` of the move/update
  moves: Moves<B, PB, SB>;
  boardMoves?: BoardMoves<B, PB, SB>;
  gameSettings?: GameSettings;
  gamePlayerSettings?: GamePlayerSettings;

  // Do we have `score`s for this game? This means for instance that we can show
  // a leaderboard.

  // Type of the match score. This is when there is only one score for the match.
  // This tells us how to format it. A defined matchScoreType also means we can have a leaderboard.
  matchScoreType?: ScoreType;

  // Type of the player score. This is when there is only one score per player.
  playerScoreType?: ScoreType;

  // Games can customize the match score representation using this hook.
  getMatchScoreText?: (options: GetMatchScoreTextOptions<B>) => string;

  // Return a move for a given state of the game for a player. This is used for bots and
  // could be used to play for an unactive user.
  // Not that technically we don't need the `secretboard` in here. In practice sometimes
  // we put data in the secretboard to optimize calculations.
  autoMove?: AutoMoveType<B, PB, SB>;
  getAgent?: GetAgent<B, PB>;

  // Game-level bot move duration.
  botMoveDuration?: number;

  // Log the board to the console. This is mostly used for debugging.
  logBoard?: (options: {
    board: B;
    playerboards: Record<UserId, PB>;
  }) => string;

  // Min/max number of players for the game.
  // Note that a bot counts as a player!
  minPlayers: number;
  maxPlayers: number;

  // Should we use the locale from when the match was created?
  // By default we use the locale from the users' settings which is passed to the match
  // using a search param in the URL.
  useInitialLocale?: boolean;

  stats?: GameStats;
};

/*
 * Internal representation of the game definition.
 *
 * When developing a game, use `GameDef` instead.
 */
export type GameDef_<B = unknown, PB = unknown, SB = unknown> = Omit<
  GameDef<B, PB, SB>,
  "stats"
> & {
  stats?: {
    allIds: string[];
    // Note that we don't have any flags for stats yet, hence the `Record<string, never>`.
    byId: Record<string, Record<string, never>>;
  };
};

/*
 * Parse a @lefun/game game definition into our internal game definition.
 */
export function parseGameDef<B, PB, SB>(
  gameDef: GameDef<B, PB, SB>,
): GameDef_<B, PB, SB> {
  // Normalize the stats.
  const { stats: stats_ } = gameDef;

  const stats: GameDef_<B, PB, SB>["stats"] = {
    allIds: [],
    byId: {},
  };

  if (stats_) {
    for (const { key } of stats_) {
      stats.allIds.push(key);
      stats.byId[key] = {};
    }
  }
  return { ...gameDef, stats };
}

//
// Special Move
//

// This is a special move that game developers can implement rules for. If they
// do, players will be able to join in the middle of a match.
export const [ADD_PLAYER, addPlayer] = createMove<{
  userId: UserId;
}>("lefun/addPlayerMove");

// Note that there is also a kickFromMatch "action" in the 'common' package.
export const [KICK_PLAYER, kickPlayer] = createMove<{
  userId: UserId;
}>("lefun/kickPlayer");

// This is a special move that will be triggered at the start of the match.
// This way games can implement some logic before any player makes a move, for instance
// triggering a delayed move.
export const [INIT_MOVE, initMove] = createMove("lefun/initMove");

// Move triggered by the server when we need to abruptly end a match.
export const [MATCH_WAS_ABORTED, matchWasAborted] = createMove(
  "lefun/matchWasAborted",
);

// Game Manifest
export type GameManifest = {
  // TODO: It's a string but currently we are assuming it can be parse to an integer!
  version: string;
  packages: {
    ui: string;
    game: string;
    data?: string;
  };

  credits?: Credits;

  // Keeping for backward compatibility.
  minPlayers?: number;
  maxPlayers?: number;
  meta?: {
    relatedGames: {
      how: AkaType;
      games: string[];
      link: string;
    };
    tagline: string;
    description: string;
    seoAka: string;
  };
  name?: string;
};
