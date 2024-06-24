import {
  AkaType,
  // Move,
  AnyMove,
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

// Think about how to name those:
// GameStateBase?
// GameStateUnknonw? UnkownGameState?
//
export type GameState = { B: unknown; PB: unknown; SB: unknown };

// This one should be "GameState" I think
export type GameStateDefault<B, PB = EmptyObject, SB = EmptyObject> = {
  B: B;
  PB: PB;
  SB: SB;
};

// type GameMoves<GS extends GameState> = Record<string, PlayerMove<GS>> & {
// INIT_MOVE?: PlayerMove<GS>;
// };
//
// type GameMovesGeneric<
// GS extends GameState,
// M extends Record<string, PlayerMove<GS>>,
// > = Record<K, PlayerMove<GS>>;

// export type GameStateDefault = { B: never; PB: never; SB: never };

type EmptyObject = Record<string, never>;

// We provide a default payload for when we don't need one (for example for moves
// without any options). This has the side effect of allowing for a missing
// payload when one should be required.
export const createMove = <K extends string, P = EmptyObject>(
  name: K,
): [K, (payload?: P) => { name: K; payload: P }] => {
  const f = (payload: P = {} as any) => {
    return { name, payload };
  };
  return [name, f];
};

export const DELAYED_MOVE = "lefun/delayedMove";

export type Move<K extends string, P = object> = {
  name: K;
  payload: P;
};

/*
 * Construct a delayed move "action"
 */
export const delayedMove = <K extends string, P = object>(
  move: Move<K, P>,
  // Timestamp (using something like `new Date().getTime()`)
  ts: number,
): DelayedMove<K, P> => {
  return {
    type: DELAYED_MOVE,
    ts,
    move,
  };
};

export type DelayedMove<K extends string, P = object> = {
  type: typeof DELAYED_MOVE;
  // Time at which we want the move to be executed.
  ts: number;
  // The update itself.
  move: Move<K, P>;
};

export type RewardPayload = {
  rewards: Record<UserId, number>;
  stats?: Record<UserId, Record<string, number>>;
};

export type SpecialFuncs = {
  delayMove: (move: AnyMove, delay: number) => { ts: number };
  itsYourTurn: (arg0: ItsYourTurnPayload) => void;
  endMatch: (arg0?: EndMatchOptions) => void;
  reward?: (options: RewardPayload) => void;
  logStat: (key: string, value: number) => void;
};

type ExecuteNowOptions<G extends GameState, P> = {
  userId: UserId;
  board: G["B"];
  // Assume that the game developer has defined the playerboard if they're using it.
  playerboard: G["PB"];
  payload: P;
  delayMove: SpecialFuncs["delayMove"];
};

export type ExecuteNow<G extends GameState, P> = (
  options: ExecuteNowOptions<G, P>,
  // TODO: We should support returning anything and it would be passed to `execute`.
) => void | false;

export type ExecuteOptions<G extends GameState, P> = {
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

export type Execute<G extends GameState, P> = (
  options: ExecuteOptions<G, P>,
) => void;

export type PlayerMove<G extends GameState, P> = {
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

export type BoardExecute<G extends GameState, P> = (
  options: Omit<ExecuteOptions<G, P>, "userId">,
) => void;

export type BoardMove<G extends GameState, P> = {
  execute?: BoardExecute<G, P>;
};

export type BoardMoves<G extends GameState> = Record<
  string,
  BoardMove<G, unknown>
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

export type InitialPlayerboardOptions<G extends GameState> = {
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

export type AutoMoveRet<GS extends GameState, GM extends GameMoves<GS>> =
  | {
      move: GameMove<GS, GM>;
      duration?: number;
    }
  | GameMove<GS, GM>;

type AutoMoveType<GS extends GameState, GM extends GameMoves<GS>> = (arg0: {
  userId: UserId;
  board: GS["B"];
  playerboard: GS["PB"];
  secretboard: GS["SB"];
  random: Random;
  returnAutoMoveInfo: boolean;
}) => AutoMoveRet<GS, GM>;

type GetAgent<B, PB> = (arg0: {
  matchSettings: MatchSettings;
  matchPlayerSettings: MatchPlayerSettings;
  numPlayers: number;
}) => Promise<Agent<B, PB>>;

// export type AgentGetMoveRet<K extends string, P> = {
export type AgentGetMoveRet<GS extends GameState, GM extends GameMoves<any>> = {
  // The `move` that should be performed.
  move: GameMove<GS, GM>;
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

// FIXME GameMovesBase
export type GameMoves<G extends GameState> = Record<string, PlayerMove<G, any>>;

export type MoveName<GS extends GameState, GM extends GameMoves<GS>> = Extract<
  keyof GM,
  string
>;

type ExtractPayload<PM> = PM extends PlayerMove<GameState, infer P> ? P : never;

export type MovePayload<
  GS extends GameState,
  GM extends GameMoves<GS>,
  K extends MoveName<GS, GM>,
> = ExtractPayload<GM[K]>;

export type GameMove<
  GS extends GameState,
  GM extends GameMoves<GS>,
  K extends MoveName<GS, GM> = MoveName<GS, GM>,
> = {
  name: K;
  payload: MovePayload<GS, GM, K>;
};

// This is what the game developer must implement.
export type GameDef<
  G extends GameState,
  GM extends GameMoves<G>,
  // M, // extends Record<string, PlayerMove<G>>,
  // K extends string,// = string,
  // M extends Moves<G>, //, K>// = Moves<G, string>,
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
  moves: GM;
  boardMoves?: BoardMoves<G>;
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
  autoMove?: AutoMoveType<G, GM>;
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

/*
 * Internal representation of the game definition.
 *
 * When developing a game, use `GameDef` instead.
 */
export type GameDef_<GS extends GameState, GM extends GameMoves<GS>> = Omit<
  GameDef<GS, GM>,
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
export function parseGameDef<GS extends GameState, GM extends GameMoves<GS>>(
  gameDef: GameDef<GS, GM>,
): GameDef_<GS, GM> {
  // Normalize the stats.
  const { stats: stats_ } = gameDef;

  const stats: GameDef_<GS, GM>["stats"] = {
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
export const [ADD_PLAYER, addPlayer] = createMove<
  "lefun/addPlayerMove",
  {
    userId: UserId;
  }
>("lefun/addPlayerMove");

// Note that there is also a kickFromMatch "action" in the 'common' package.
export const [KICK_PLAYER, kickPlayer] = createMove<
  "lefun/kickPlayer",
  {
    userId: UserId;
  }
>("lefun/kickPlayer");

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
