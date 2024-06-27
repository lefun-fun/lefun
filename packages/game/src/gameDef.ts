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
  ScoreType,
  UserId,
} from "@lefun/core";

import { Random } from "./random";

export type GameStateBase = { B: unknown; PB: unknown; SB: unknown };

export type GameState<B, PB = EmptyObject, SB = EmptyObject> = {
  B: B;
  PB: PB;
  SB: SB;
};

type EmptyObject = Record<string, never>;

export const INIT_MOVE = "lefun/initMove";
export const initMove = () => ({ name: INIT_MOVE, payload: {} });

export const ADD_PLAYER = "lefun/addPlayer";
export const addPlayer = ({ userId }: { userId: UserId }) => ({
  name: ADD_PLAYER,
  payload: { userId },
});

export const KICK_PLAYER = "lefun/kickPlayer";
export const kickPlayer = ({ userId }: { userId: UserId }) => ({
  name: KICK_PLAYER,
  payload: { userId },
});

export const MATCH_WAS_ABORTED = "lefun/matchWasAborted";
export const matchWasAborted = () => ({ name: MATCH_WAS_ABORTED, payload: {} });

type IsEmptyObject<T, TRUE, FALSE> = [T[keyof T]] extends [never]
  ? TRUE
  : FALSE;

type PayloadArgs<P> = IsEmptyObject<P, [], [P]>;

export function definePlayerMove<GS extends GameStateBase, P = EmptyObject>(
  name: string,
  def: PlayerMoveDef<GS, P>,
): [
  Record<string, PlayerMoveDef<GS, P>>,
  (...args: PayloadArgs<P>) => PlayerMove<P>,
] {
  return [
    { [name]: def },
    (...args: PayloadArgs<P>) =>
      (args.length > 0
        ? { name, payload: args[0] }
        : { name, payload: {} }) as PlayerMove<P>,
  ];
}

export function defineBoardMove<GS extends GameStateBase, P = EmptyObject>(
  name: string,
  def: BoardMoveDef<GS, P>,
): [
  Record<string, BoardMoveDef<GS, P>>,
  (...args: PayloadArgs<P>) => BoardMove<P>,
] {
  return [
    { [name]: def },
    (...args: PayloadArgs<P>) =>
      (args.length > 0
        ? { name, payload: args[0] }
        : { name, payload: {} }) as BoardMove<P>,
  ];
}

export type RewardPayload = {
  rewards: Record<UserId, number>;
  stats?: Record<UserId, Record<string, number>>;
};

export type SpecialFuncs = {
  delayMove: (move: BoardMove<unknown>, delay: number) => { ts: number };
  itsYourTurn: (arg0: ItsYourTurnPayload) => void;
  endMatch: (arg0?: EndMatchOptions) => void;
  reward?: (options: RewardPayload) => void;
  logStat: (key: string, value: number) => void;
};

type ExecuteNowOptions<GS extends GameStateBase, P> = {
  userId: UserId;
  board: GS["B"];
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: GS["PB"];
  payload: P;
  delayMove: SpecialFuncs["delayMove"];
};

export type ExecuteNow<G extends GameStateBase, P> = (
  options: ExecuteNowOptions<G, P>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<G extends GameStateBase, P> = {
  userId: UserId;
  board: G["B"];
  // Even though `playerboards` and `secretboard` are optional, we'll assume that the
  // game developer has defined them if they use them if their execute* functions!
  playerboards: Record<UserId, G["PB"]>;
  secretboard: G["SB"];
  payload: P;
  random: Random;
  ts: number;
  gameData: any;
  matchData?: any;
} & SpecialFuncs;

export type Execute<G extends GameStateBase, P> = (
  options: ExecuteOptions<G, P>,
) => void;

export type PlayerMoveDef<G extends GameStateBase, P = EmptyObject> = {
  canDo?: (options: {
    userId: UserId;
    board: G["B"];
    playerboard: G["PB"];
    payload: P;
    // We'll pass `null` on the client, where we don't have the server time.
    ts: number | null;
  }) => boolean;
  executeNow?: ExecuteNow<G, P>;
  execute?: Execute<G, P>;
};

export type BoardExecute<G extends GameStateBase, P> = (
  options: Omit<ExecuteOptions<G, P>, "userId">,
) => void;

export type BoardMoveDef<G extends GameStateBase, P = EmptyObject> = {
  execute?: BoardExecute<G, P>;
};

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

export type InitialPlayerboardOptions<G extends GameStateBase> = {
  userId: UserId;
  board: G["B"];
  secretboard: G["SB"];
  // Those are the playerboards for the *other* players.
  playerboards: Record<UserId, G["PB"]>;
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

export type AutoMoveRet =
  | {
      move: PlayerMove<any>;
      duration?: number;
    }
  | PlayerMove<any>;

type AutoMoveType<GS extends GameStateBase> = (arg0: {
  userId: UserId;
  board: GS["B"];
  playerboard: GS["PB"];
  secretboard: GS["SB"];
  random: Random;
  returnAutoMoveInfo: boolean;
}) => AutoMoveRet;

type GetAgent<B, PB> = (arg0: {
  matchSettings: MatchSettings;
  matchPlayerSettings: MatchPlayerSettings;
  numPlayers: number;
}) => Promise<Agent<B, PB>>;

export type AgentGetMoveRet<P = unknown> = {
  // The `move` that should be performed.
  move: PlayerMove<P>;
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

export type PlayerMove<P = unknown> = { name: string; payload: P };
export type BoardMove<P = unknown> = { name: string; payload: P };
export type DelayedBoardMove = BoardMove & { ts: number };

// This is what the game developer must implement.
export type GameDef<G extends GameStateBase = GameStateBase> = {
  initialBoards: (options: InitialBoardsOptions<G["B"]>) => {
    board: G["B"];
    playerboards?: Record<UserId, G["PB"]>;
    secretboard?: G["SB"];
    itsYourTurnUsers?: UserId[];
  };
  // There is a separate function for the `playerboard` for games that support adding a
  // player into an ongoing match.
  initialPlayerboard?: (options: InitialPlayerboardOptions<G>) => G["PB"];

  // For those the key is the `name` of the move/update
  playerMoves: Record<string, PlayerMoveDef<G, any>>;
  boardMoves?: Record<string, BoardMoveDef<G, any>>;
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
  getMatchScoreText?: (options: GetMatchScoreTextOptions<G["B"]>) => string;

  // Return a move for a given state of the game for a player. This is used for bots and
  // could be used to play for an unactive user.
  // Not that technically we don't need the `secretboard` in here. In practice sometimes
  // we put data in the secretboard to optimize calculations.
  autoMove?: AutoMoveType<G>;
  getAgent?: GetAgent<G["B"], G["PB"]>;

  // Game-level bot move duration.
  botMoveDuration?: number;

  // Log the board to the console. This is mostly used for debugging.
  logBoard?: (options: {
    board: G["B"];
    playerboards: Record<UserId, G["PB"]>;
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

// export const makeGameDef = <
//   GS extends GameStateBase,
//   PM extends PlayerMoveDefs<GS, BMT>,
//   BM extends BoardMoveDefs<GS, BMT>,
//   BMT = BMTFromBoardMoveDefs<BM>,
// >(
//   gameDef: GameDef<GS, PM, BM, BMT>,
// ) => gameDef;

/*
 * Internal representation of the game definition.
 *
 * When developing a game, use `GameDef` instead.
 */
export type GameDef_<GS extends GameStateBase> = Omit<GameDef<GS>, "stats"> & {
  stats?: {
    allIds: string[];
    // Note that we don't have any flags for stats yet, hence the `EmptyObject`.
    byId: Record<string, EmptyObject>;
  };
};

/*
 * Parse a @lefun/game game definition into our internal game definition.
 */
export function parseGameDef<GS extends GameStateBase>(
  gameDef: GameDef<GS>,
): GameDef_<GS> {
  // Normalize the stats.
  const { stats: stats_ } = gameDef;

  const stats: GameDef_<GS>["stats"] = {
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
