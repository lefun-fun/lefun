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
import { IfNever } from "./typing";

export type GameStateBase = { B: unknown; PB: unknown; SB: unknown };

type BMTBase = Record<string, unknown>;

export type GameState<B, PB = EmptyObject, SB = EmptyObject> = {
  B: B;
  PB: PB;
  SB: SB;
};

type NoPayload = never;

type EmptyObject = Record<string, never>;

export const INIT_MOVE = "lefun/initMove";

export const ADD_PLAYER = "lefun/addPlayer";
export type AddPlayerPayload = {
  userId: UserId;
};

export const KICK_PLAYER = "lefun/kickPlayer";
export type KickPlayerPayload = {
  userId: UserId;
};

export const MATCH_WAS_ABORTED = "lefun/matchWasAborted";

export type RewardPayload = {
  rewards: Record<UserId, number>;
  stats?: Record<UserId, Record<string, number>>;
};

export type DelayMove<BMT extends BMTBase> = <K extends keyof BMT & string>(
  moveName: K,
  ...rest: IfNever<BMT[K], [number], [BMT[K], number]>
) => { ts: number };

export type SpecialFuncs<BMT extends BMTBase> = {
  delayMove: DelayMove<BMT>;
  itsYourTurn: (arg0: ItsYourTurnPayload) => void;
  endMatch: (arg0?: EndMatchOptions) => void;
  reward?: (options: RewardPayload) => void;
  logStat: (key: string, value: number) => void;
};

type ExecuteNowOptions<GS extends GameStateBase, P, BMT extends BMTBase> = {
  userId: UserId;
  board: GS["B"];
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: GS["PB"];
  payload: P;
  delayMove: SpecialFuncs<BMT>["delayMove"];
};

export type ExecuteNow<G extends GameStateBase, P, BMT extends BMTBase> = (
  options: ExecuteNowOptions<G, P, BMT>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<G extends GameStateBase, P, BMT extends BMTBase> = {
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

export type Execute<G extends GameStateBase, P, BMT extends BMTBase> = (
  options: ExecuteOptions<G, P, BMT>,
) => void;

export type PlayerMove<
  G extends GameStateBase,
  P = NoPayload,
  BMT extends BMTBase = EmptyObject,
> = {
  canDo?: (options: {
    userId: UserId;
    board: G["B"];
    playerboard: G["PB"];
    payload: P;
    // We'll pass `null` on the client, where we don't have the server time.
    ts: number | null;
  }) => boolean;
  executeNow?: ExecuteNow<G, P, BMT>;
  execute?: Execute<G, P, BMT>;
};

export type BoardExecute<G extends GameStateBase, P, BMT extends BMTBase> = (
  options: Omit<ExecuteOptions<G, P, BMT>, "userId">,
) => void;

export type BoardMove<
  G extends GameStateBase,
  P = NoPayload,
  BMT extends BMTBase = EmptyObject,
> = {
  execute?: BoardExecute<G, P, BMT>;
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

export type GetPayload<
  G extends Game<any>,
  K extends keyof G["playerMoves"] & string,
> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  G["playerMoves"][K] extends PlayerMove<infer G, infer P, infer BMT>
    ? P
    : never;

/*
 * `name: string` if the move doesn't have any payload, [name: string, payload: ?]
 * otherwise.
 */
type MoveObj<G extends Game<any>> = {
  [K in keyof G["playerMoves"] & string]: IfNever<
    GetPayload<G, K>,
    K,
    [K, GetPayload<G, K>]
  >;
}[keyof G["playerMoves"] & string];

/*
 * Stateless function that returns a bot move.
 */
export type AutoMove<GS extends GameStateBase, G extends Game<GS>> = (arg0: {
  userId: UserId;
  board: GS["B"];
  playerboard: GS["PB"];
  secretboard: GS["SB"];
  random: Random;
  withInfo: boolean;
}) => BotMove<G>;

/*
 * Return a stateful way (a `Agent` class) to get bot moves.
 */
export type GetAgent<GS extends GameStateBase, G extends Game<GS>> = (arg0: {
  matchSettings: MatchSettings;
  matchPlayerSettings: MatchPlayerSettings;
  numPlayers: number;
}) => Promise<Agent<GS, G>>;

export type BotMove<G extends Game<any>> =
  | MoveObj<G>
  | {
      move: MoveObj<G>;
      // Some info used for training.
      autoMoveInfo?: AutoMoveInfo;
      // How much "thinking time" should be pretend this move took.
      // After having calculated our move, we'll wait the difference before actually
      // executing the move so that it takes that much time.
      duration?: number;
    };

export abstract class Agent<GS extends GameStateBase, G extends Game<GS>> {
  abstract getMove({
    board,
    playerboard,
    random,
    userId,
    withInfo,
    verbose,
  }: {
    board: GS["B"];
    playerboard: GS["PB"];
    random: Random;
    userId: UserId;
    withInfo: boolean;
    verbose?: boolean;
  }): Promise<BotMove<G>>;
}

export type GetMatchScoreTextOptions<B> = {
  board: B;
};

// This is what the game developer must implement.
export type Game<
  GS extends GameStateBase,
  BMT extends BMTBase = EmptyObject,
  PM extends Record<string, PlayerMove<GS, any, BMT>> = any,
  BM extends Record<string, BoardMove<GS, any, BMT>> = any,
> = {
  initialBoards: (options: InitialBoardsOptions<GS["B"]>) => {
    board: GS["B"];
    playerboards?: Record<UserId, GS["PB"]>;
    secretboard?: GS["SB"];
    itsYourTurnUsers?: UserId[];
  };
  // There is a separate function for the `playerboard` for games that support adding a
  // player into an ongoing match.
  initialPlayerboard?: (options: InitialPlayerboardOptions<GS>) => GS["PB"];

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
  getMatchScoreText?: (options: GetMatchScoreTextOptions<GS["B"]>) => string;

  // Game-level bot move duration.
  botMoveDuration?: number;

  // Log the board to the console. This is mostly used for debugging.
  logBoard?: (options: {
    board: GS["B"];
    playerboards: Record<UserId, GS["PB"]>;
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
 * When developing a game, use `Game` instead.
 */
export type Game_<GS extends GameStateBase, BMT extends BMTBase> = Omit<
  Game<GS, BMT>,
  "stats"
> & {
  stats?: {
    allIds: string[];
    // Note that we don't have any flags for stats yet, hence the `EmptyObject`.
    byId: Record<string, EmptyObject>;
  };
};

/*
 * Parse a @lefun/game game definition into our internal game definition.
 */
export function parseGame<GS extends GameStateBase, BMT extends BMTBase>(
  game: Game<GS, BMT>,
): Game_<GS, BMT> {
  // Normalize the stats.
  const { stats: stats_ } = game;

  const stats: Game_<GS, BMT>["stats"] = {
    allIds: [],
    byId: {},
  };

  if (stats_) {
    for (const { key } of stats_) {
      stats.allIds.push(key);
      stats.byId[key] = {};
    }
  }

  return { ...game, stats };
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

/* Util to parse the diverse format that can take bot moves, as returned by `autoMove`
 * and `Agent.getMove`.
 */
export function parseBotMove<G extends Game<any, any>>(
  botMove: BotMove<G>,
): {
  name: string;
  payload?: unknown;
  autoMoveInfo?: AutoMoveInfo;
  duration?: number;
} {
  let name: string;
  let payload: unknown = undefined;
  let autoMoveInfo: AutoMoveInfo | undefined = undefined;
  let duration: number | undefined = undefined;

  if (typeof botMove === "string") {
    name = botMove;
  } else if (Array.isArray(botMove)) {
    [name, payload] = botMove;
  } else {
    ({ autoMoveInfo, duration } = botMove);

    const { move } = botMove;
    if (typeof move === "string") {
      name = move;
    } else {
      [name, payload] = move;
    }
  }

  return { name, payload, autoMoveInfo, duration };
}
