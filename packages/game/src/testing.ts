import {
  Locale,
  MatchPlayerSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  metaRemoveUserFromMatch,
  UserId,
} from "@lefun/core";

import {
  ADD_PLAYER,
  Agent,
  AutoMove,
  AutoMoveInfo,
  BotMove,
  DelayMove,
  Game,
  Game_,
  GameStateBase,
  GetAgent,
  GetPayload,
  INIT_MOVE,
  KICK_PLAYER,
  MATCH_WAS_ABORTED,
  // MoveTypesBase,
  parseBotMove,
  parseGame,
  RewardPayload,
  Turns,
} from "./gameDef";
import { Random } from "./random";
import { IfNever, IfUnknown } from "./typing";
import { parseMove, parseTurnUserIds } from "./utils";

type DelayedPlayerMove = {
  type: "playerMove";
  name: string;
  payload: any;
  ts: number;
  userId: UserId;
};

// The main different with DelayedPlayerMove is that userId is optional.
type DelayedBoardMove = {
  type: "boardMove";
  name: string;
  payload: any;
  ts: number;
  // We still need the `userId` when it's a move that is triggered when the player's turn expires.
  userId?: UserId;
};

type DelayedMove = DelayedBoardMove | DelayedPlayerMove;

export type MatchTesterOptions<
  GS extends GameStateBase,
  G extends Game<GS>, //, PMT, BMT>,
  // PMT extends MoveTypesBase = MoveTypesBase,
  // BMT extends MoveTypesBase = MoveTypesBase,
> = {
  game: G;
  getAgent?: GetAgent<GS, G>;
  autoMove?: AutoMove<GS, G>;
  gameData?: any;
  matchData?: any;
  // Num *human* players
  numPlayers: number;
  numBots?: number;
  matchSettings?: MatchSettings;
  matchPlayersSettingsArr?: MatchPlayerSettings[];
  random?: Random;
  verbose?: boolean;
  training?: boolean;
  logBoardToTrainingLog?: boolean;
  locale?: Locale;
};

export type BotTrainingLogItem =
  | {
      type: "REWARDS";
      rewards: Record<UserId, number>;
      stats?: Record<UserId, Record<string, number>>;
    }
  | ({ type: "MOVE_INFO" } & AutoMoveInfo)
  | { type: "BOARD"; value: string };

type EmptyObject = Record<string, never>;

type User = {
  username: string;
  isBot: boolean;
  isGuest: boolean;
};

type UsersState = { byId: Record<UserId, User> };

type MakeMoveOptions = { canFail?: boolean; isDelayed?: boolean };

type MakeMoveRest<
  G extends Game<any>,
  K extends keyof G["playerMoves"] & string,
> = IfUnknown<
  GetPayload<G, K>,
  [] | [any] | [any, MakeMoveOptions],
  IfNever<
    GetPayload<G, K>,
    //
    [] | [EmptyObject, MakeMoveOptions],
    //
    [GetPayload<G, K>] | [GetPayload<G, K>, MakeMoveOptions]
  >
>;

/*
type GenericPlayerMove = {
  name: string;
  payload: unknown;
};

function parsePlayerMove(moveObj: MoveObj<any>): GenericPlayerMove {
  if (typeof moveObj === "string") {
    return { name: moveObj, payload: undefined };
  }
  const [name, payload = undefined] = moveObj;
  return { name, payload };
}
*/

/*
 * Use this to test your game rules.
 * It emulates what the backend does.
 */
export class MatchTester<
  GS extends GameStateBase,
  G extends Game<GS>, //, PMT, BMT>,
  // PMT extends MoveTypesBase = MoveTypesBase,
  // BMT extends MoveTypesBase = MoveTypesBase,
> {
  game: Game_<GS>; //, PMT, BMT>;
  autoMove?: AutoMove<GS, G>;
  getAgent?: GetAgent<GS, G>;
  gameData: any;
  matchData?: any;
  meta: Meta;
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"]>;
  secretboard: GS["SB"];
  users: UsersState;
  matchHasEnded: boolean;
  random: Random;
  matchSettings;
  matchPlayersSettings;
  // Clock used for delayedMoves - in ms.
  time: number;
  // List of timers to be executed.
  delayedMoves: DelayedMove[];
  // List of end of turn player moves.
  // endOfTurnPlayerMoves: Record<UserId, DelayedMove[]>;

  // List of end of turn board moves.
  // endOfTurnBoardMoves: Record<UserId, BMT>;

  // To help generate the next userIds.
  nextUserId: number;
  // Variables to check for infinite loops.
  _sameBotCount: number;
  _lastBotUserId?: UserId;
  _botTrainingLog: BotTrainingLogItem[];
  _verbose: boolean;
  _logBoardToTrainingLog: boolean;
  _stats: { key: string; value: number }[];
  // Are we using the MatchTester for training.
  // TODO We should probably use different classes for training and for testing.
  _training: boolean;
  _agents: Record<UserId, Agent<GS, G>>;
  _isPlaying: boolean;

  // This is hacky. We need some place to store the userIds of the players whose turn
  // begins after a move.
  _lastTurnsBegin: Set<UserId>;

  constructor({
    game,
    autoMove,
    getAgent,
    gameData = undefined,
    matchData = undefined,
    numPlayers,
    numBots = 0,
    matchSettings = {},
    matchPlayersSettingsArr,
    random,
    verbose = false,
    training = false,
    logBoardToTrainingLog = false,
    locale = "en",
  }: MatchTesterOptions<GS, G>) {
    if (random == null) {
      random = new Random();
    }

    this.game = parseGame(game);

    const meta = metaInitialState({ matchSettings, locale });

    for (let i = 0; i < numPlayers; i++) {
      metaAddUserToMatch({
        meta,
        userId: `userId-${i}`,
        ts: new Date(),
        isBot: false,
      });
    }
    for (let i = 0; i < numBots; i++) {
      metaAddUserToMatch({
        meta,
        userId: `bot-userId-${i}`,
        ts: new Date(),
        isBot: true,
      });
    }

    this.nextUserId = numPlayers + numBots;

    // Default match options.
    if (game.gameSettings) {
      for (const { key, options } of game.gameSettings) {
        // If the option was already defined, we don't do anything
        if (matchSettings[key] != null) {
          continue;
        }
        // Check if there is an option marked as `default`
        let thereWasADefault = false;
        for (const option of options) {
          // If we find one, we use that one.
          if (option.default) {
            matchSettings[key] = option.value;
            thereWasADefault = true;
          }
        }
        // If there was no option marked as `default`, we use the first one.
        if (!thereWasADefault) {
          matchSettings[key] = options[0].value;
        }
      }
    }

    // Default matchPlayer options
    if (!matchPlayersSettingsArr) {
      matchPlayersSettingsArr = [];
      // Loop through the users.
      for (let nthUser = 0; nthUser < meta.players.allIds.length; ++nthUser) {
        const opts: MatchPlayerSettings = {};
        Object.entries(game.gamePlayerSettings || {}).forEach(
          ([key, optionDef]) => {
            if (optionDef.exclusive) {
              // For each user, given them the n-th option. Loop if there are less options
              // than players.
              opts[key] =
                optionDef.options[nthUser % optionDef.options.length].value;
            } else {
              // TODO We probably need a default option here!
              opts[key] = optionDef.options[0].value;
            }
          },
        );
        matchPlayersSettingsArr.push(opts);
      }
    }

    const matchPlayersSettings = Object.fromEntries(
      meta.players.allIds.map((userId, i) => [
        userId,
        matchPlayersSettingsArr ? matchPlayersSettingsArr[i] : {},
      ]),
    );

    const areBots = Object.fromEntries(
      meta.players.allIds.map((userId) => [
        userId,
        meta.players.byId[userId].isBot,
      ]),
    );

    const time = 0;

    const init = game.initialBoards({
      players: meta.players.allIds,
      matchSettings,
      matchPlayersSettings,
      gameData,
      matchData,
      random,
      areBots,
      // What about `previousBoard`?
      locale,
      ts: time,
    });

    const { board, playerboards = {}, secretboard = {} as GS["SB"] } = init;

    const users: UsersState = { byId: {} };
    meta.players.allIds.forEach((userId) => {
      users.byId[userId] = {
        username: `User ${userId}`,
        isGuest: false,
        isBot: false,
      };
    });

    this.autoMove = autoMove;
    this.getAgent = getAgent;
    this.gameData = gameData;
    this.matchData = matchData;
    this.board = board;
    this.playerboards = playerboards || {};
    this.secretboard = secretboard;
    this.matchHasEnded = false;
    this.random = random;
    this.meta = meta;
    this.time = time;
    this.delayedMoves = [];
    // this.endOfTurnPlayerMoves = {};
    this.users = users;
    this.matchSettings = matchSettings;
    this.matchPlayersSettings = matchPlayersSettings;
    this._sameBotCount = 0;

    this._botTrainingLog = [];
    this._stats = [];
    this._verbose = verbose;
    this._training = training;
    this._logBoardToTrainingLog = logBoardToTrainingLog;
    this._agents = {};

    this._isPlaying = false;
    this._lastTurnsBegin = new Set();

    // Make the special initial move.
    this._makeBoardMove(INIT_MOVE);
  }

  /*
   * Add a player mid-match
   */
  addPlayer(): UserId {
    // Add to `meta` and `playerboards`
    const {
      board,
      meta,
      playerboards,
      secretboard,
      game,
      gameData,
      matchData,
      random,
    } = this;
    const userId = `userId-${this.nextUserId}`;
    const username = `Player ${this.nextUserId}`;
    const isBot = false;
    const isGuest = false;
    this.nextUserId++;
    metaAddUserToMatch({ meta, userId, ts: new Date(), isBot });

    if (game.initialPlayerboard) {
      playerboards[userId] = game.initialPlayerboard({
        userId,
        board,
        playerboards,
        secretboard: secretboard!,
        random,
        gameData,
        matchData,
      });
    }

    // Trigger the game's logic.
    this._makeBoardMove(ADD_PLAYER, { userId });

    this.users.byId[userId] = {
      username,
      isBot,
      isGuest,
    };

    return userId;
  }

  /*
   * Kick a player mid-match
   */
  kickPlayer(userId: UserId): void {
    const { meta, playerboards } = this;

    // Trigger the game's logic.
    this._makeBoardMove(KICK_PLAYER, { userId });

    metaRemoveUserFromMatch(meta, userId);

    // Remove playerboard
    delete playerboards[userId];
  }

  /*
   * For the end of the match, as happens when all the players vote to end the match.
   */
  abortMatch(): void {
    this._endMatch();
    this._makeBoardMove(MATCH_WAS_ABORTED);
  }

  /*
   * (Force-)trigger the end of the match.
   *
   * This is also called if the game triggers the special `endMatch(..)` move.
   */
  _endMatch(): void {
    this.matchHasEnded = true;

    // metaMatchEnded(this.meta);

    // It's no-one's turn anymore.
    this.meta.players.allIds.forEach((userId) => {
      this.meta.players.byId[userId].itsYourTurn = false;
    });
    this._isPlaying = false;
  }

  async makeMoveAndContinue<K extends keyof G["playerMoves"] & string>(
    userId: UserId,
    moveName: K,
    ...rest: MakeMoveRest<G, K>
  ) {
    this.makeMove(userId, moveName, ...rest);
    await this.makeNextBotMove();
  }

  makeSpecialExecuteFuncs() {
    const endMatch = () => {
      this._endMatch();
    };

    const reward = (payload: RewardPayload) => {
      this._botTrainingLog.push({ type: "REWARDS", ...payload });
      if (this._verbose) {
        console.log(payload);
      }
    };

    /*
    const itsYourTurn = (payload: ItsYourTurnPayload): void => {
      if (this.matchHasEnded) {
        return;
      }
      metaItsYourTurn(this.meta, payload);
    };
    */

    const turnsbegin: Turns<any, any>["begin"] = (
      userIds,
      { expiresIn, boardMoveOnExpire, playerMoveOnExpire } = {},
    ) => {
      userIds = parseTurnUserIds(userIds, {
        allUserIds: this.meta.players.allIds,
      });
      for (const userId of userIds) {
        this._lastTurnsBegin.add(userId);
        // Clear previous turn player moves for that player.
        this.delayedMoves = this.delayedMoves.filter(
          ({ userId: otherUserId }) => otherUserId !== userId,
        );

        this.meta.players.byId[userId].itsYourTurn = true;
        if (playerMoveOnExpire) {
          const { name, payload } = parseMove(playerMoveOnExpire);
          if (expiresIn === undefined) {
            throw new Error("expiresIn is required for playerMoveOnExpire");
          }

          this.delayedMoves.push({
            type: "playerMove",
            name,
            payload,
            ts: this.time + expiresIn,
            userId,
          });
        }

        // Note that it is one boardMove per user.
        if (boardMoveOnExpire) {
          const { name, payload } = parseMove(boardMoveOnExpire);
          if (expiresIn === undefined) {
            throw new Error("expiresIn is required for playerMoveOnExpire");
          }
          this.delayedMoves.push({
            type: "boardMove",
            name,
            payload,
            ts: this.time + expiresIn,
            // We need the `userId` to stop it if the player makes a move.
            userId,
          });
        }
      }
    };

    const turnsEnd: Turns<any, any>["end"] = (userIds) => {
      userIds = parseTurnUserIds(userIds, {
        allUserIds: this.meta.players.allIds,
      });
      for (const userId of userIds) {
        this._lastTurnsBegin.delete(userId);
        this.meta.players.byId[userId].itsYourTurn = false;

        // Clear previous turn player moves for that player.
        this.delayedMoves = this.delayedMoves.filter(
          ({ userId: otherUserId }) => otherUserId !== userId,
        );
      }
    };

    // const isTurn: Turns<any, any>["isTurn"] = (userId) => {
    //   return this.meta.players.byId[userId].itsYourTurn;
    // };

    const turns: Turns<any, any> = {
      end: turnsEnd,
      begin: turnsbegin,
      // isTurn,
    };

    const delayMove: DelayMove = (
      name: string,
      ...payloadAndDelay: any[] //IfNever<BMT[K], [number], [BMT[K], number]>
    ) => {
      const [payload, delay] =
        payloadAndDelay.length === 1
          ? [{}, payloadAndDelay[0]]
          : payloadAndDelay;

      const ts = this.time + delay;

      // In the match tester, we only note the delayed move. We'll execute them only if
      // we `fastForward`.
      this.delayedMoves.push({
        type: "boardMove" as const,
        name,
        payload,
        ts,
      });
      return { ts };
    };

    const logPlayerStat = () => {
      //
    };

    const logMatchStat = () => {
      //
    };

    return { delayMove, turns, endMatch, reward, logPlayerStat, logMatchStat };
  }

  _makeBoardMove(moveName: string, payload: any = {}) {
    const {
      game,
      board,
      playerboards,
      secretboard,
      gameData,
      matchData,
      time,
      random,
    } = this;
    const { boardMoves } = game;

    if (!boardMoves || !boardMoves[moveName]) {
      // When the move is not defined, throw only if it's not one of our optional move.
      if (![INIT_MOVE, MATCH_WAS_ABORTED].includes(moveName)) {
        throw new Error(`board move ${moveName} not defined`);
      }

      return;
    }

    const { execute } = boardMoves[moveName];

    if (!execute) {
      console.warn(`board move "${moveName}" not defined`);
      return;
    }

    const specialExecuteFuncs = this.makeSpecialExecuteFuncs();

    try {
      execute({
        board,
        playerboards,
        // We trust that the game developer won't use the secretboard if it's not
        // defined!
        secretboard,
        payload,
        gameData,
        matchData,
        random,
        ts: time,
        ...specialExecuteFuncs,
      });
    } catch (e) {
      console.warn(`board move "${moveName}" failed with error`);
      console.warn(e);
    }

    this.fastForward(0);
  }

  makeMove<K extends keyof G["playerMoves"] & string>(
    userId: UserId,
    moveName: K,
    ...rest: MakeMoveRest<G, K>
  ) {
    const [payload, { canFail = false, isDelayed = false }] =
      rest.length === 0
        ? [undefined, {}]
        : rest.length === 1
          ? [rest[0], {}]
          : rest;

    const {
      board,
      playerboards,
      secretboard,
      gameData,
      matchData,
      random,
      game,
      meta,
      time,
    } = this;

    if (!game.playerMoves[moveName]) {
      throw new Error(`game does not implement ${moveName}`);
    }

    // Make sure the userId is in our list of users.
    if (meta.players.byId[userId] === undefined) {
      throw new Error(`unknown userId ${userId}`);
    }

    const { playerMoves } = game;

    const moveDef = playerMoves[moveName];

    if (!moveDef) {
      throw new Error(`unknown move ${moveName}`);
    }

    const playerboard = playerboards[userId];

    const { canDo, executeNow, execute } = game.playerMoves[moveName];

    if (
      !isDelayed &&
      canDo &&
      !canDo({ userId, board, playerboard, payload, ts: time })
    ) {
      if (!canFail) {
        throw new Error(`can not do move "${moveName}"`);
      }

      console.warn(`can not do move "${moveName}"`);
      return;
    }

    const specialExecuteFuncs = this.makeSpecialExecuteFuncs();

    const { turns } = specialExecuteFuncs;

    this._lastTurnsBegin.clear();

    try {
      let retValue;
      if (executeNow) {
        retValue = executeNow({
          userId,
          board,
          playerboard,
          payload,
          ...specialExecuteFuncs,
        });
      }
      if (retValue !== false && execute) {
        execute({
          userId,
          board,
          playerboards,
          secretboard,
          gameData,
          matchData,
          payload,
          random,
          ts: time,
          ...specialExecuteFuncs,
        });
      }
    } catch (e) {
      console.warn(
        "an error occured in one of the `execute*` functions in MatchTester - this means a bug in the game",
      );
      console.warn(e);
      throw new Error("error in move");
    }

    // When a user makes a move, we end their turn (unless the move starts it again).
    // Remember that this also clears the delayed moves for that player.
    if (!this._lastTurnsBegin.has(userId)) {
      turns.end(userId);
    }

    this.fastForward(0);
  }

  async start() {
    if (this._isPlaying) {
      throw new Error("already playing");
    }
    this._isPlaying = true;
    const { getAgent, meta, _agents, matchSettings, matchPlayersSettings } =
      this;

    const numPlayers = meta.players.allIds.length;

    // Initialize agents.
    if (getAgent) {
      for (const userId of meta.players.allIds) {
        if (meta.players.byId[userId].isBot) {
          _agents[userId] = await getAgent({
            matchPlayerSettings: matchPlayersSettings[userId],
            matchSettings,
            numPlayers,
          });
        }
      }
    }
    await this.makeNextBotMove();
  }

  async makeNextBotMove({ max = null }: { max?: number | null } = {}) {
    if (!this._isPlaying) {
      await this.start();
      // Return because `start` calls makeNextBotMove.
      return;
    }
    const { meta, game, autoMove, board, playerboards, secretboard, random } =
      this;
    // Check if we should do a bot move.
    for (
      let userIndex = 0;
      userIndex < meta.players.allIds.length;
      ++userIndex
    ) {
      const userId = meta.players.allIds[userIndex];
      const { isBot, itsYourTurn } = meta.players.byId[userId];

      if (isBot && itsYourTurn) {
        let boardRepr: string | undefined = undefined;
        if ((this._verbose || this._logBoardToTrainingLog) && game.logBoard) {
          boardRepr = game.logBoard({ board, playerboards });

          if (this._verbose) {
            console.log("----------------------");
            console.log(userId, "'s turn");
            console.log(boardRepr);
          }
        }

        const t0 = new Date().getTime();
        const agent = this._agents[userId];

        let botMove: BotMove<G> | undefined = undefined;

        const args = {
          board,
          playerboard: playerboards[userId],
          secretboard,
          userId,
          random,
          withInfo: this._training,
        };

        if (autoMove) {
          botMove = await autoMove(args);
        } else if (agent) {
          botMove = await agent.getMove(args);
        } else {
          throw new Error("no autoMove or agent defined");
        }

        const { name, payload, autoMoveInfo } = parseBotMove(botMove);

        const t1 = new Date().getTime();

        const thinkingTime = t1 - t0;

        if (autoMoveInfo) {
          autoMoveInfo.time = thinkingTime;
          this._botTrainingLog.push({ type: "MOVE_INFO", ...autoMoveInfo });
        }

        if (this._logBoardToTrainingLog) {
          this._botTrainingLog.push({
            type: "BOARD",
            value: (autoMoveInfo?.stringRepr || "") + "\n\n" + boardRepr || "",
          });
        }

        if (userId === this._lastBotUserId) {
          this._sameBotCount++;
        } else {
          this._sameBotCount = 0;
          this._lastBotUserId = userId;
        }
        if (this._sameBotCount > 1000) {
          throw new Error(
            "The same bot played too many times in a row. Did you forget to `yield itsYourTurn(...)`?",
          );
        }

        // We only play one bot move per call. The function will be called again if it's
        // another bot's turn after.
        await this.makeMove(
          userId,
          name,
          ...((payload === undefined ? [] : [payload]) as any),
        );

        // TODO Test this
        if (max === null || max >= 2) {
          await this.makeNextBotMove({
            max: max === null ? null : max - 1,
          });
        }
        return;
      }
    }
    // No bot played this time.
    this._sameBotCount = 0;
  }

  // State as `client` or `@lefun/ui-testing` expect it.
  getState(userId: UserId) {
    const { board, playerboards, users } = this;
    return {
      board,
      userId,
      playerboard: playerboards[userId],
      users,
    };
  }

  /*
   * With this function we simulate passing time and execute delayedUpdates
   *
   * delta: time that passed in milli-seconds
   */
  fastForward(delta: number): void {
    this.time += delta;

    // We do it in a loop in case moves queue delayed moves in 0ms, which we want to do
    // right away.
    for (let i = 0; i < 4096; i++) {
      const { pastMoves, futureMoves } = splitDelayedMoves(
        this.delayedMoves,
        this.time,
      );

      // When there are no past moves, we can't add more in 0ms, so we are done.
      if (pastMoves.length === 0) {
        return;
      }

      this.delayedMoves = futureMoves;

      for (const delayedMove of pastMoves) {
        const { type, name, payload, userId } = delayedMove;
        if (type === "playerMove") {
          this.makeMove(
            userId,
            name,
            ...([payload, { isDelayed: true }] as any),
          );
        } else {
          this._makeBoardMove(name, payload);
        }
      }
    }

    throw new Error("Too many recursions in `fastForward`");
  }

  get botTrainingLog() {
    return this._botTrainingLog;
  }

  get stats() {
    return this._stats;
  }

  clearStats() {
    this._stats = [];
  }
}

// FIXME test this
/* Filter and sort delayed move before a given timestamp. If two moves have the
 * same timestamp we keep them in the order they were added. */
function splitDelayedMoves(
  delayedMoves: DelayedMove[],
  ts: number,
): { pastMoves: DelayedMove[]; futureMoves: DelayedMove[] } {
  // Execute the delayed updates that have happend during that time *in order*. If two
  // have the same timestamp, execute the one that was queued first.
  const pastMoves = delayedMoves
    .filter((dm) => dm.ts <= ts)
    // Sort by time, but keep the order in case of equality.
    .map((dm, i) => [dm, i] as [DelayedMove, number])
    .sort(([dm1, i1], [dm2, i2]) => Math.sign(dm1.ts - dm2.ts) || i1 - i2)
    // Back to an object.
    .map(([dm]) => dm);

  const futureMoves = delayedMoves.filter((dm) => dm.ts > ts);

  return { pastMoves, futureMoves };
}
