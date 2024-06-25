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

export const DELAYED_MOVE = "lefun/delayedMove";

export type Move<K extends string, P = object> = {
  name: K;
  payload: P;
};

/*
 * Construct a delayed move "action"
 */
export const delayedMove = <BMT, K extends BoardMoveName<BMT>>(
  move: BoardMoveWithOptionalPayload<BMT, K>,
  // Timestamp (using something like `new Date().getTime()`)
  ts: number,
): DelayedMove<BMT, K> => {
  return {
    type: DELAYED_MOVE,
    ts,
    move,
  };
};

export type DelayedMove<BMT, T extends BoardMoveName<BMT>> = {
  type: typeof DELAYED_MOVE;
  // Time at which we want the move to be executed.
  ts: number;
  // The update itself.
  move: BoardMoveWithOptionalPayload<BMT, T>;
};

export type RewardPayload = {
  rewards: Record<UserId, number>;
  stats?: Record<UserId, Record<string, number>>;
};

// FIXME here we need to extend the board game moves.
export type SpecialFuncs<BMT> = {
  delayMove: <K extends BoardMoveName<BMT>>(
    move: BoardMoveWithOptionalPayload<BMT, K>,
    delay: number,
  ) => { ts: number };
  itsYourTurn: (arg0: ItsYourTurnPayload) => void;
  endMatch: (arg0?: EndMatchOptions) => void;
  reward?: (options: RewardPayload) => void;
  logStat: (key: string, value: number) => void;
};

type ExecuteNowOptions<GS extends GameStateBase, BMT, P> = {
  userId: UserId;
  board: GS["B"];
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: GS["PB"];
  payload: P;
  delayMove: SpecialFuncs<BMT>["delayMove"];
};

export type ExecuteNow<G extends GameStateBase, BMT, P> = (
  options: ExecuteNowOptions<G, BMT, P>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<G extends GameStateBase, BMT, P> = {
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
} & SpecialFuncs<BMT>;

export type Execute<G extends GameStateBase, BMT, P> = (
  options: ExecuteOptions<G, BMT, P>,
) => void;

export type PlayerMoveDef<
  G extends GameStateBase,
  BMT = EmptyObject,
  P = EmptyObject,
> = {
  canDo?: (options: {
    userId: UserId;
    board: G["B"];
    playerboard: G["PB"];
    payload: P;
    // We'll pass `null` on the client, where we don't have the server time.
    ts: number | null;
  }) => boolean;
  executeNow?: ExecuteNow<G, BMT, P>;
  execute?: Execute<G, BMT, P>;
};

export type BoardExecute<G extends GameStateBase, BMT, P> = (
  options: Omit<ExecuteOptions<G, BMT, P>, "userId">,
) => void;

export type BoardMoveDef<G extends GameStateBase, BMT, P = EmptyObject> = {
  execute?: BoardExecute<G, BMT, P>;
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

// FIXME any
export type AutoMoveRet<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
> =
  | {
      move: PlayerMove<GS, PM, any>;
      duration?: number;
    }
  | PlayerMove<GS, PM, any>;

type AutoMoveType<
  GS extends GameStateBase,
  // FIXME
  PM extends PlayerMoveDefs<GS, any>,
> = (arg0: {
  userId: UserId;
  board: GS["B"];
  playerboard: GS["PB"];
  secretboard: GS["SB"];
  random: Random;
  returnAutoMoveInfo: boolean;
}) => AutoMoveRet<GS, PM>;

type GetAgent<B, PB> = (arg0: {
  matchSettings: MatchSettings;
  matchPlayerSettings: MatchPlayerSettings;
  numPlayers: number;
}) => Promise<Agent<B, PB>>;

export type AgentGetMoveRet<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
> = {
  // The `move` that should be performed.
  move: PlayerMove<GS, PM, any>;
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
  }): Promise<AgentGetMoveRet<any, any>>;
}

export type GetMatchScoreTextOptions<B> = {
  board: B;
};

export type PlayerMoveDefs<G extends GameStateBase, BMT = EmptyObject> = {
  [key: string]: PlayerMoveDef<G, BMT, any>;
};

export type BoardMoveDefs<G extends GameStateBase, BMT> = Record<
  keyof BMT,
  BoardMoveDef<G, BMT, any>
>;

export type PlayerMoveName<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
> = Extract<keyof PM, string>;

export type PlayerMovePayload<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
  K extends PlayerMoveName<GS, PM>,
> = PM[K] extends PlayerMoveDef<GS, any, infer P> ? P : never;

type PlayerMove<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
  K extends PlayerMoveName<GS, PM> = PlayerMoveName<GS, PM>,
> = {
  name: K;
  payload: PlayerMovePayload<GS, PM, K>;
};

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type PlayerMoveWithOptionalPayload<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, any>,
  K extends PlayerMoveName<GS, PM>,
> = [PlayerMovePayload<GS, PM, K>[keyof PlayerMovePayload<GS, PM, K>]] extends [
  never,
]
  ? Optional<PlayerMove<GS, PM, K>, "payload">
  : PlayerMove<GS, PM, K>;

export type BoardMoveName<BMT> = Extract<keyof BMT, string>;

type BoardMovePayload<BMT, K extends keyof BMT> = BMT[K];

export type BoardMove<BMT, K extends BoardMoveName<BMT>> = {
  name: K;
  payload: BMT[K];
};

export type BoardMoveWithOptionalPayload<BMT, K extends BoardMoveName<BMT>> = [
  BoardMovePayload<BMT, K>[keyof BoardMovePayload<BMT, K>],
] extends [never]
  ? Optional<BoardMove<BMT, K>, "payload">
  : BoardMove<BMT, K>;

type BMTFromBoardMoveDefs<BM extends BoardMoveDefs<any, any>> =
  BM extends BoardMoveDefs<any, infer BMT> ? BMT : never;

// This is what the game developer must implement.
export type GameDef<
  G extends GameStateBase,
  PM extends PlayerMoveDefs<G, BMT>,
  BM extends BoardMoveDefs<G, BMT> = any,
  BMT = BMTFromBoardMoveDefs<BM>,
> = {
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
  playerMoves: PM;
  boardMoves?: BM;
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
  autoMove?: AutoMoveType<G, PM>;
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

// export function makeGameDef<
//   GS extends GameStateBase,
//   PM extends PlayerMoveDefs<GS, BMT>,
//   BM extends BoardMoveDefs<GS, BMT>,
//   BMT,
// >(gameDef: GameDef<GS, PM, BM, BMT>) {
//   return gameDef;
// }
export const makeGameDef = <
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, BMT>,
  BM extends BoardMoveDefs<GS, BMT>,
  BMT = BMTFromBoardMoveDefs<BM>,
>(
  gameDef: GameDef<GS, PM, BM, BMT>,
) => gameDef;

/*
 * Internal representation of the game definition.
 *
 * When developing a game, use `GameDef` instead.
 */
export type GameDef_<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, BMT>,
  BM extends BoardMoveDefs<GS, BMT>,
  BMT,
> = Omit<GameDef<GS, PM, BM, BMT>, "stats"> & {
  stats?: {
    allIds: string[];
    // Note that we don't have any flags for stats yet, hence the `EmptyObject`.
    byId: Record<string, EmptyObject>;
  };
};

/*
 * Parse a @lefun/game game definition into our internal game definition.
 */
export function parseGameDef<
  GS extends GameStateBase,
  PM extends PlayerMoveDefs<GS, BMT>,
  BM extends BoardMoveDefs<GS, BMT>,
  BMT,
>(gameDef: GameDef<GS, PM, BM, BMT>): GameDef_<GS, PM, BM, BMT> {
  // Normalize the stats.
  const { stats: stats_ } = gameDef;

  const stats: GameDef_<GS, PM, BM, BMT>["stats"] = {
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
