import {
  EndMatchOptions,
  ItsYourTurnPayload,
  Locale,
  MatchPlayerSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  metaItsYourTurn,
  metaMatchEnded,
  metaRemoveUserFromMatch,
  Move,
  UserId,
} from "@lefun/core";

import {
  addPlayer,
  Agent,
  AgentGetMoveRet,
  AutoMoveInfo,
  AutoMoveRet,
  DelayedMove,
  delayedMove,
  GameDef,
  GameDef_,
  INIT_MOVE,
  initMove,
  kickPlayer,
  MATCH_WAS_ABORTED,
  matchWasAborted,
  parseGameDef,
  RewardPayload,
} from "./gameDef";
import { Random } from "./random";

type MatchTesterOptions<B, PB, SB> = {
  gameDef: GameDef<B, PB, SB>;
  gameData?: any;
  matchData?: any;
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

/*
 * Use this to test your game rules.
 * It emulates what the backend does.
 */
export class MatchTester<B, PB = EmptyObject, SB = EmptyObject> {
  gameDef: GameDef_<B, PB, SB>;
  gameData: any;
  matchData?: any;
  meta: Meta;
  board: B;
  playerboards: Record<UserId, PB>;
  secretboard: SB;
  users: UsersState;
  matchHasEnded: boolean;
  random: Random;
  matchSettings;
  matchPlayersSettings;
  // Clock used for delayedMoves - in ms.
  time: number;
  // List of timers to be executed.
  delayedMoves: DelayedMove[];
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
  _agents: Record<UserId, Agent<B, PB>>;
  _isPlaying: boolean;

  constructor({
    gameDef,
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
  }: MatchTesterOptions<B, PB, SB>) {
    if (random == null) {
      random = new Random();
    }

    this.gameDef = parseGameDef(gameDef);

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
    if (gameDef.gameSettings) {
      for (const { key, options } of gameDef.gameSettings) {
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
        Object.entries(gameDef.gamePlayerSettings || {}).forEach(
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

    const {
      board,
      playerboards = {},
      secretboard = {} as SB,
      itsYourTurnUsers = [],
    } = gameDef.initialBoards({
      players: meta.players.allIds,
      matchSettings,
      matchPlayersSettings,
      gameData,
      matchData,
      random,
      areBots,
      // What about `previousBoard`?
      locale,
    });

    itsYourTurnUsers.forEach((userId) => {
      meta.players.byId[userId].itsYourTurn = true;
    });

    const users: UsersState = { byId: {} };
    meta.players.allIds.forEach((userId) => {
      users.byId[userId] = {
        username: `User ${userId}`,
        isGuest: false,
        isBot: false,
      };
    });

    this.gameData = gameData;
    this.matchData = matchData;
    this.board = board;
    this.playerboards = playerboards || {};
    this.secretboard = secretboard;
    this.matchHasEnded = false;
    this.random = random;
    this.meta = meta;
    this.time = 0;
    this.delayedMoves = [];
    this.users = users;
    this.matchSettings = matchSettings;
    this.matchPlayersSettings = matchPlayersSettings;
    this._sameBotCount = 0;

    // Make the special initial move.
    this.makeBoardMove(initMove());

    this._botTrainingLog = [];
    this._stats = [];
    this._verbose = verbose;
    this._training = training;
    this._logBoardToTrainingLog = logBoardToTrainingLog;
    this._agents = {};

    this._isPlaying = false;
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
      gameDef,
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

    if (gameDef.initialPlayerboard) {
      playerboards[userId] = gameDef.initialPlayerboard({
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
    this.makeBoardMove(addPlayer({ userId }));

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
    this.makeBoardMove(kickPlayer({ userId }));

    metaRemoveUserFromMatch(meta, userId);

    // Remove playerboard
    delete playerboards[userId];
  }

  /*
   * For the end of the match, as happens when all the players vote to end the match.
   */
  abortMatch(): void {
    this._endMatch({});
    this.makeBoardMove(matchWasAborted());
  }

  /*
   * (Force-)trigger the end of the match.
   *
   * This is also called if the game triggers the special `endMatch(..)` move.
   */
  _endMatch(endMatchOptions: EndMatchOptions): void {
    this.matchHasEnded = true;

    metaMatchEnded(this.meta, endMatchOptions, this.gameDef.playerScoreType);

    // It's no-one's turn anymore.
    this.meta.players.allIds.forEach((userId) => {
      this.meta.players.byId[userId].itsYourTurn = false;
    });
    this._isPlaying = false;
  }

  async makeMoveAndContinue(
    userId: UserId,
    move: Move,
    { canFail = false }: { canFail?: boolean } = {},
  ) {
    this.makeMove(userId, move, { canFail });
    await this.makeNextBotMove();
  }

  makeSpecialExecuteFuncs() {
    const endMatch = (options?: EndMatchOptions) => {
      this._endMatch(options || {});
    };

    const reward = (payload: RewardPayload) => {
      this._botTrainingLog.push({ type: "REWARDS", ...payload });
      if (this._verbose) {
        console.log(payload);
      }
    };

    const itsYourTurn = (payload: ItsYourTurnPayload): void => {
      if (this.matchHasEnded) {
        return;
      }
      metaItsYourTurn(this.meta, payload);
    };

    const delayMove = (move: Move, delay: number) => {
      const dm = delayedMove(move, this.time + delay);
      // In the match tester, we only note the delayed move. We'll execute them only if
      // we `fastForward`.
      this.delayedMoves.push(dm);
      return { ts: dm.ts };
    };

    const logStat = (key: string, value: number) => {
      this._stats.push({ key, value });
    };

    return { delayMove, itsYourTurn, endMatch, reward, logStat };
  }

  makeBoardMove(move: Move) {
    const { name, payload } = move;
    const {
      gameDef,
      board,
      playerboards,
      secretboard,
      gameData,
      matchData,
      time,
      random,
    } = this;
    const { boardMoves } = gameDef;

    if (!boardMoves || !boardMoves[name]) {
      // When the move is not defined, throw only if it's not one of our optional move.
      if (![INIT_MOVE, MATCH_WAS_ABORTED].includes(name)) {
        throw new Error(`board move ${name} not defined`);
      }

      return;
    }

    const { execute } = boardMoves[name];

    if (!execute) {
      console.warn(`board move "${name}" not defined`);
      return;
    }

    const specialExecuteFuncs = this.makeSpecialExecuteFuncs();

    try {
      execute({
        board,
        playerboards,
        // We trust that the game developer won't use the secretboard if it's not
        // defined!
        secretboard: secretboard!,
        payload,
        gameData,
        matchData,
        random,
        ts: time,
        ...specialExecuteFuncs,
      });
    } catch (e) {
      console.warn(`board move "${name}" failed with error`);
      console.warn(e);
    }
  }

  makeMove(
    userId: UserId,
    move: Move,
    { canFail = false }: { canFail?: boolean } = {},
  ) {
    const { name, payload } = move;

    const {
      board,
      playerboards,
      secretboard,
      gameData,
      matchData,
      random,
      gameDef,
      meta,
      time,
    } = this;

    if (!gameDef.moves[name]) {
      throw new Error(`game does not implement ${name}`);
    }

    // Make sure the userId is in our list of users.
    if (meta.players.byId[userId] === undefined) {
      throw new Error(`unknown userId ${userId}`);
    }

    const { moves } = gameDef;

    const moveDef = moves[name];

    if (!moveDef) {
      throw new Error(`unknown move ${name}`);
    }

    const playerboard = playerboards[userId];

    const { canDo, executeNow, execute } = gameDef.moves[name];

    if (
      canDo !== undefined &&
      !canDo({ userId, board, playerboard, payload, ts: time })
    ) {
      if (!canFail) {
        throw new Error(`can not do move "${name}"`);
      }
      return;
    }

    const specialExecuteFuncs = this.makeSpecialExecuteFuncs();

    const { delayMove } = specialExecuteFuncs;

    try {
      let retValue;
      if (executeNow) {
        retValue = executeNow({
          userId,
          board,
          playerboard: playerboard!,
          payload,
          delayMove,
        });
      }
      if (retValue !== false && execute) {
        execute({
          userId,
          board,
          playerboards,
          secretboard: secretboard!,
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
  }

  async start() {
    if (this._isPlaying) {
      throw new Error("already playing");
    }
    this._isPlaying = true;
    const { gameDef, meta, _agents, matchSettings, matchPlayersSettings } =
      this;

    const numPlayers = meta.players.allIds.length;

    // Initialize agents.
    // TODO remove the `if` when we deprecate `autoMove`.
    if (gameDef.getAgent) {
      for (const userId of meta.players.allIds) {
        if (meta.players.byId[userId].isBot) {
          _agents[userId] = await gameDef.getAgent({
            matchPlayerSettings: matchPlayersSettings[userId],
            matchSettings,
            numPlayers,
          });
        }
      }
    }
    await this.makeNextBotMove();
  }

  async makeNextBotMove() {
    const { meta, gameDef, board, playerboards, secretboard, random } = this;
    // Check if we should do a bot move.
    for (
      let userIndex = 0;
      userIndex < meta.players.allIds.length;
      ++userIndex
    ) {
      //userId of meta.players.allIds) {
      const userId = meta.players.allIds[userIndex];
      const { isBot, itsYourTurn } = meta.players.byId[userId];

      if (isBot && itsYourTurn) {
        let boardRepr: string | undefined = undefined;
        if (
          (this._verbose || this._logBoardToTrainingLog) &&
          gameDef.logBoard
        ) {
          boardRepr = gameDef.logBoard({ board, playerboards });

          if (this._verbose) {
            console.log("----------------------");
            console.log(userId, "'s turn");
            console.log(boardRepr);
          }
        }

        // let autoMoveRet: ReturnType<Agent<B, PB>['getMove']>;
        let autoMoveRet: AutoMoveRet | AgentGetMoveRet;
        const t0 = new Date().getTime();
        if (gameDef.autoMove !== undefined) {
          // TODO deprecate the `autoMove` function in favor of the AutoMover class?
          autoMoveRet = await gameDef.autoMove({
            board,
            playerboard: playerboards[userId],
            secretboard: secretboard!,
            userId,
            random,
            returnAutoMoveInfo: this._training,
          });
        } else {
          autoMoveRet = await this._agents[userId].getMove({
            board,
            playerboard: playerboards[userId],
            random,
            userId,
            withInfo: this._training,
            verbose: this._logBoardToTrainingLog,
          });
        }
        const t1 = new Date().getTime();

        const thinkingTime = t1 - t0;

        let move: Move | undefined;
        let autoMoveInfo: AutoMoveInfo | undefined = undefined;

        if ("autoMoveInfo" in autoMoveRet) {
          if (autoMoveRet.autoMoveInfo !== undefined) {
            autoMoveInfo = autoMoveRet.autoMoveInfo;
          }
          ({ move } = autoMoveRet);
        } else {
          if ("move" in autoMoveRet) {
            ({ move } = autoMoveRet);
          } else {
            move = autoMoveRet;
          }
        }

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

        if (move) {
          // We only play one bot move per call. The function will be called again if it's
          // another bot's turn after.
          return await this.makeMoveAndContinue(userId, move);
        }
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
    // Execute the delayed updates that have happend during that time *in order*. If two
    // have the same timestamp, execute the one that was queued first.
    const delayedMoves = this.delayedMoves.filter((du) => du.ts <= this.time);
    // Sort by time, but keep the order in case of equality.
    delayedMoves
      .map((u, i) => [u, i] as [DelayedMove, number])
      .sort(([u1, i1], [u2, i2]) => Math.sign(u1.ts - u2.ts) || i1 - i2);

    for (const delayedMove of delayedMoves) {
      const { move } = delayedMove;
      this.makeBoardMove(move);
    }
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
