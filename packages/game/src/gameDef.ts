import {
  AkaType,
  Credits,
  GamePlayerSettings,
  GameSettings,
  GameStat,
  Locale,
  MatchPlayerSettings,
  MatchPlayersSettings,
  MatchSettings,
  UserId,
} from "@lefun/core";

import { Random } from "./random";
import { IfNull } from "./typing";

export type GameStateBase = { B: any; PB: any; SB: any };

export type MoveTypesBase = Record<string, any>;

export type GameState<B, PB = EmptyObject, SB = EmptyObject> = {
  B: B;
  PB: PB;
  SB: SB;
};

type EmptyObject = Record<string, never>;

// type NoPayload = EmptyObject;

// FIXME tester avec des games differents avec plus ou moins de typing
// Tout mettre ca dans des tests .d.ts
export type GameStats = GameStat[];

// Special moves

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

// We always compute ranks at the end of matches.
// export const RANK = "lefun/rank";

export type RewardPayload = {
  rewards: Record<UserId, number>;
  // TODO Now that we have proper stats, we should use those instead.
  stats?: Record<UserId, Record<string, number>>;
};

export type DelayMove<BMT extends MoveTypesBase = MoveTypesBase> = <
  K extends keyof BMT & string,
>(
  moveName: K,
  ...rest: IfAny<
    BMT[K],
    [number] | [any, number],
    IfNull<BMT[K], [number], [BMT[K], number]>
  >
) => { ts: number };

type IfUnknown<T, TRUE, FALSE> = [T] extends [unknown] ? TRUE : FALSE;

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

export type Turns<
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
> = {
  end: (userIds: UserId | UserId[] | "all") => void;
  begin: (
    userIds: UserId | UserId[] | "all",
    options?: {
      // FIXME We need to make sure that either boardMoveOnExpire or playerMoveOnExpire is set. Or we need to implement something like ending the turn at expireAt without trigerring any move.
      expiresIn?: number;
      // FIXME double check this
      // boardMoveOnExpire?: string | [string, any] /*IfUnknown<
      boardMoveOnExpire?: IfUnknown<
        MoveObjFromMT<BMT>,
        string | [string, any],
        IfNull<BMT, never, MoveObjFromMT<BMT>>
      >;
      // FIXME test this in a .d.ts file
      // Basically we want for things to work even when PMT/BMT are not used.
      // playerMoveOnExpire?: string | [string, any] /*IfUnknown<
      playerMoveOnExpire?: IfUnknown<
        MoveObjFromMT<PMT>,
        string | [string, any],
        IfNull<PMT, never, MoveObjFromMT<PMT>>
      >;
    },
  ) => void;
  // isTurn: (userId: UserId) => boolean;
};

type StatsKeys<S extends GameStats> = S extends { key: infer K }[] ? K : never;

export type SpecialFuncs<
  PMT extends MoveTypesBase,
  BMT extends MoveTypesBase,
  PS extends GameStats = GameStats,
  MS extends GameStats = GameStats,
> = {
  delayMove: DelayMove<BMT>;
  turns: Turns<PMT, BMT>;
  endMatch: () => void;
  reward?: (options: RewardPayload) => void;
  logPlayerStat: (userId: UserId, key: StatsKeys<PS>, value: number) => void;
  logMatchStat: (key: StatsKeys<MS>, value: number) => void;
  // Backward-compatibility.
  // itsYourTurn?: (arg0: any) => void;
};

type ExecuteNowOptions<
  GS extends GameStateBase,
  P,
  PMT extends MoveTypesBase,
  BMT extends MoveTypesBase,
  PS extends GameStats,
  MS extends GameStats,
> = {
  userId: UserId;
  board: GS["B"];
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: GS["PB"];
  payload: P;
} & SpecialFuncs<PMT, BMT, PS, MS>;

export type ExecuteNow<
  GS extends GameStateBase = GameStateBase,
  P = any,
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
  PS extends GameStats = GameStats,
  MS extends GameStats = GameStats,
> = (
  options: ExecuteNowOptions<GS, P, PMT, BMT, PS, MS>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<
  GS extends GameStateBase,
  P,
  PMT extends MoveTypesBase,
  BMT extends MoveTypesBase,
  PS extends GameStats,
  MS extends GameStats,
> = {
  userId: UserId;
  board: GS["B"];
  // Even though `playerboards` and `secretboard` are optional, we'll assume that the
  // game developer has defined them if they use them if their execute* functions!
  playerboards: Record<UserId, GS["PB"]>;
  secretboard: GS["SB"];
  payload: P;
  random: Random;
  ts: number;
  gameData: any;
  matchData?: any;
} & SpecialFuncs<PMT, BMT, PS, MS>;

export type Execute<
  GS extends GameStateBase = GameStateBase,
  P = any,
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
  PS extends GameStats = GameStats,
  MS extends GameStats = GameStats,
> = (options: ExecuteOptions<GS, P, PMT, BMT, PS, MS>) => void;

export type PlayerMove<
  GS extends GameStateBase = GameStateBase,
  P = any,
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
  PS extends GameStats = GameStats,
  MS extends GameStats = GameStats,
> = {
  canDo?: (options: {
    userId: UserId;
    board: GS["B"];
    playerboard: GS["PB"];
    payload: P;
    // We'll pass `null` on the client, where we don't have the server time.
    ts: number | null;
  }) => boolean;
  executeNow?: ExecuteNow<GS, P, PMT, BMT, PS, MS>;
  execute?: Execute<GS, P, PMT, BMT, PS, MS>;
};

export type BoardExecute<
  GS extends GameStateBase,
  P,
  PMT extends MoveTypesBase,
  BMT extends MoveTypesBase,
  PS extends GameStats,
  MS extends GameStats,
> = (options: Omit<ExecuteOptions<GS, P, PMT, BMT, PS, MS>, "userId">) => void;

export type BoardMove<
  GS extends GameStateBase,
  P = any,
  PMT extends MoveTypesBase = EmptyObject,
  BMT extends MoveTypesBase = EmptyObject,
  PS extends GameStats = GameStats,
  MS extends GameStats = GameStats,
> = {
  execute?: BoardExecute<GS, P, PMT, BMT, PS, MS>;
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
  // Timestamp at which the match is started.
  ts: number;
};

export type InitialPlayerboardOptions<GS extends GameStateBase> = {
  userId: UserId;
  board: GS["B"];
  secretboard: GS["SB"];
  // Those are the playerboards for the *other* players.
  playerboards: Record<UserId, GS["PB"]>;
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
  G extends Game,
  K extends keyof G["playerMoves"] & string,
> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  G["playerMoves"][K] extends PlayerMove<infer G, infer P, infer PMT, infer BMT>
    ? P
    : never;

/*
 * `name: string` if the move doesn't have any payload, [name: string, payload: ?]
 * otherwise.
 */
export type MoveObj<G extends Game> = {
  [K in keyof G["playerMoves"] & string]: IfNull<
    GetPayload<G, K>,
    K,
    [K, GetPayload<G, K>]
  >;
}[keyof G["playerMoves"] & string];

type MoveObjFromMT<MT extends MoveTypesBase> = {
  [K in keyof MT & string]: IfNull<MT[K], K, [K, MT[K]]>;
}[keyof MT & string];

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
  GS extends GameStateBase = GameStateBase,
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
  PM extends Record<string, PlayerMove<GS, any, PMT, BMT>> = Record<
    string,
    PlayerMove<GS, any, PMT, BMT>
  >,
  BM extends Record<string, BoardMove<GS, any, PMT, BMT>> = Record<
    string,
    BoardMove<GS, any, PMT, BMT>
  >,
> = {
  version: string;
  initialBoards: (options: InitialBoardsOptions<GS["B"]>) => {
    board: GS["B"];
    playerboards?: Record<UserId, GS["PB"]>;
    secretboard?: GS["SB"];
    // Backward compatibility
    // itsYourTurnUsers?: UserId | UserId[] | "all";
    // New name
    // itsTheirTurn?: UserId | UserId[] | "all";
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

  // mainScoreStat ?:

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

  playerStats?: GameStats;
  matchStats?: GameStats;
}; // & GameCompat;

// type GameCompat = {
//   matchScoreType?: any;
//   playerScoreType?: any;
// };

type Stats_ = {
  allIds: string[];
  byId: Record<string, GameStat>;
};

/*
 * Internal representation of the game definition.
 *
 * When developing a game, use `Game` instead.
 */
export type Game_<
  GS extends GameStateBase,
  PMT extends MoveTypesBase = MoveTypesBase,
  BMT extends MoveTypesBase = MoveTypesBase,
> = Omit<Game<GS, PMT, BMT>, "playerStats" | "matchStats"> & {
  playerStats?: Stats_;
  matchStats?: Stats_;
};

function normalizeArray<T extends Record<string, any>, K extends keyof T>(
  arr: T[],
  key: K,
): { allIds: T[K][]; byId: Record<T[K], T> } {
  const allIds = arr.map((item) => item[key]);
  const byId = Object.fromEntries(arr.map((item) => [item[key], item]));
  return { allIds, byId };
}

/*
 * Parse a @lefun/game game definition into our internal game definition.
 */
export function parseGame<
  GS extends GameStateBase,
  PMT extends MoveTypesBase,
  BMT extends MoveTypesBase,
>(game: Game<GS, PMT, BMT>): Game_<GS, PMT, BMT> {
  // Normalize the stats.

  const playerStats =
    game.playerStats === undefined
      ? undefined
      : normalizeArray(game.playerStats, "key");

  const matchStats =
    game.matchStats === undefined
      ? undefined
      : normalizeArray(game.matchStats, "key");

  return { ...game, playerStats, matchStats };
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
