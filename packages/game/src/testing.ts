import {
  Locale,
  MatchPlayerSettings,
  MatchPlayersSettings,
  MatchSettings,
  Meta,
  metaAddUserToMatch,
  metaBeginTurn,
  metaEndTurn,
  metaInitialState,
  metaRemoveUserFromMatch,
  UserId,
} from "@lefun/core";
import { IfAnyNull } from "@lefun/core";

import {
  DelayedMove,
  executeBoardMove,
  executePlayerMove,
  Stat,
} from "./execution";
import {
  ADD_PLAYER,
  Agent,
  AutoMove,
  AutoMoveInfo,
  BotMove,
  Game,
  Game_,
  GameStateBase,
  GetAgent,
  GetPayload,
  INIT_MOVE,
  InitialBoardsOutput,
  KICK_PLAYER,
  MATCH_WAS_ABORTED,
  parseBotMove,
  parseGame,
} from "./gameDef";
import { Random } from "./random";

export type MatchTesterOptions<GS extends GameStateBase, G extends Game<GS>> = {
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
  training?: boolean;
  logBoardToTrainingLog?: boolean;
  locale?: Locale;
  logger?: Logger;
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

type MakeMoveOptions = { canFail?: boolean; isDelayed?: boolean };

type MakeMoveRest<
  G extends Game<any>,
  K extends keyof G["playerMoves"] & string,
> = IfAnyNull<
  GetPayload<G, K>,
  // any
  [] | [any] | [any, MakeMoveOptions],
  // null
  [] | [EmptyObject | null, MakeMoveOptions],
  // other
  [GetPayload<G, K>] | [GetPayload<G, K>, MakeMoveOptions]
>;

export interface Logger {
  debug?(obj: unknown, msg?: string, ...args: unknown[]): void;
  info?(obj: unknown, msg?: string, ...args: unknown[]): void;
  warn?(obj: unknown, msg?: string, ...args: unknown[]): void;
  error?(obj: unknown, msg?: string, ...args: unknown[]): void;
}

/*
 * Use this to test your game rules.
 * It emulates what the backend does.
 */
export class MatchTester<GS extends GameStateBase, G extends Game<GS>> {
  game: Game_<GS>;
  autoMove?: AutoMove<GS, G>;
  getAgent?: GetAgent<GS, G>;
  gameData: any;
  matchData?: any;
  meta: Meta;
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"]>;
  secretboard: GS["SB"];
  matchHasEnded: boolean;
  random: Random;
  matchSettings: MatchSettings;
  matchPlayersSettings: MatchPlayersSettings;
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
  _logBoardToTrainingLog: boolean;
  // Are we using the MatchTester for training.
  // TODO We should probably use different classes for training and for testing.
  _training: boolean;
  _agents: Record<UserId, Agent<GS, G>>;
  _isPlaying: boolean;

  playerStats: Record<UserId, { key: string; value: number }[]>;
  matchStats: { key: string; value: number }[];

  logger?: Logger;

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
    training = false,
    logBoardToTrainingLog = false,
    locale = "en",
    logger = undefined,
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
          if (option.isDefault) {
            matchSettings[key] = option.value;
            thereWasADefault = true;
          }
        }
        // If there was no option marked as `default`, we use the first one.
        if (!thereWasADefault) {
          matchSettings[key] = options[0]!.value;
        }
      }
    }

    // Default matchPlayer options
    const { gamePlayerSettings } = this.game;
    if (!matchPlayersSettingsArr && gamePlayerSettings) {
      matchPlayersSettingsArr = [];
      // Loop through the users.
      for (let nthUser = 0; nthUser < meta.players.allIds.length; ++nthUser) {
        const opts: MatchPlayerSettings = {};
        gamePlayerSettings.allIds.forEach((key) => {
          const optionDef = gamePlayerSettings.byId[key];
          if (!optionDef) {
            throw new Error("option def is falsy");
          }
          if (optionDef.exclusive) {
            // For each user, given them the n-th option. Loop if there are less options
            // than players.
            opts[key] =
              optionDef.options[nthUser % optionDef.options.length]!.value;
          } else {
            // TODO We probably need a default option here!
            opts[key] = optionDef.options[0]!.value;
          }
        });
        matchPlayersSettingsArr.push(opts);
      }
    }

    const matchPlayersSettings = Object.fromEntries(
      meta.players.allIds.map((userId, i) => [
        userId,
        matchPlayersSettingsArr ? matchPlayersSettingsArr[i]! : {},
      ]),
    );

    const areBots = Object.fromEntries(
      meta.players.allIds.map((userId) => [
        userId,
        meta.players.byId[userId]!.isBot,
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

    const {
      board,
      playerboards = {},
      secretboard = {},
    } = init as InitialBoardsOutput<GameStateBase>;

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
    this.matchSettings = matchSettings;
    this.matchPlayersSettings = matchPlayersSettings;
    this._sameBotCount = 0;

    this._botTrainingLog = [];
    this._training = training;
    this._logBoardToTrainingLog = logBoardToTrainingLog;
    this._agents = {};

    this._isPlaying = false;

    this.playerStats = {};
    this.matchStats = [];

    this.logger = logger;

    // Make the special initial move.
    if (game.boardMoves?.[INIT_MOVE]) {
      this._makeBoardMove(INIT_MOVE);
    }
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
    const isBot = false;

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

    // It's no-one's turn anymore.
    this.meta.players.allIds.forEach((userId) => {
      this.meta.players.byId[userId]!.itsYourTurn = false;
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

  _doMoveSideEffects({
    matchHasEnded,
    beginTurn,
    endTurn,
    delayedMoves,
    stats,
  }: {
    matchHasEnded: boolean;
    beginTurn: Record<UserId, { expiresAt?: number }>;
    endTurn: Record<UserId, null>;
    delayedMoves: DelayedMove[];
    stats: Stat[];
  }) {
    const { meta, time } = this;

    for (const [userId, { expiresAt }] of Object.entries(beginTurn)) {
      metaBeginTurn({
        meta,
        userId,
        beginsAt: time,
        expiresAt,
      });

      // Clear previous turn player moves for that player: in other words only the
      // lastest `turns.begin` counts for a given player.
      this.delayedMoves = this.delayedMoves.filter(
        ({ userId: otherUserId }) => otherUserId !== userId,
      );
    }

    for (const userId of Object.keys(endTurn)) {
      metaEndTurn({ meta, userId });
      // Clear previous turn player moves for that player.
      this.delayedMoves = this.delayedMoves.filter(
        ({ userId: otherUserId }) => otherUserId !== userId,
      );
    }

    this.delayedMoves.push(...delayedMoves);
    // Make sure these new delayed moves are in the right order.
    sortDelayedMoves(this.delayedMoves);

    for (const stat of stats) {
      const { key, value, userId } = stat;
      if (userId) {
        if (!this.playerStats[userId]) {
          this.playerStats[userId] = [];
        }
        this.playerStats[userId].push({ key, value });
      } else {
        this.matchStats.push({ key, value });
      }
    }

    // Do this *after* the turns because it will end all turns.
    if (matchHasEnded) {
      this._endMatch();
    }
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
      meta,
    } = this;

    const output = executeBoardMove<GS>({
      name: moveName,
      payload,
      meta,
      board,
      playerboards,
      secretboard,
      matchData,
      gameData,
      now: time,
      game,
      random,
    });

    {
      const { matchHasEnded, delayedMoves, beginTurn, endTurn, stats } = output;

      this._doMoveSideEffects({
        matchHasEnded,
        delayedMoves,
        beginTurn,
        endTurn,
        stats,
      });
    }

    {
      const { board, playerboards, secretboard } = output;

      this.board = board;
      this.playerboards = playerboards;
      this.secretboard = secretboard;
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

    this.logger?.info?.({ userId, moveName, payload }, "makeMove");

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

    let error = false;
    let output: ReturnType<typeof executePlayerMove<GS>> | undefined =
      undefined;
    try {
      output = executePlayerMove<GS>({
        name: moveName,
        payload,
        userId,
        meta,
        board,
        playerboards,
        secretboard,
        matchData,
        gameData,
        now: time,
        game,
        random,
        skipCanDo: !!isDelayed,
      });
    } catch (e) {
      error = true;
      if (canFail) {
        this.logger?.warn?.("Error but canFail=true");
        console.warn(e);
      } else {
        throw e;
      }
    }

    if (!error && output) {
      const { matchHasEnded, delayedMoves, beginTurn, endTurn, stats } = output;

      this._doMoveSideEffects({
        matchHasEnded,
        delayedMoves,
        beginTurn,
        endTurn,
        stats,
      });

      {
        const { board, playerboards, secretboard } = output;

        this.board = board;
        this.playerboards = playerboards;
        this.secretboard = secretboard;
      }
    }

    // Execute the delayed moves that would happen in 0ms.
    this.fastForward(0);
  }

  async start({ max = null }: { max?: number | null } = {}) {
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
        if (meta.players.byId[userId]!.isBot) {
          _agents[userId] = await getAgent({
            matchPlayerSettings: matchPlayersSettings[userId]!,
            matchSettings,
            numPlayers,
          });
        }
      }
    }
    await this.makeNextBotMove({ max });
  }

  async makeNextBotMove({ max = null }: { max?: number | null } = {}) {
    if (!this._isPlaying) {
      await this.start({ max });
      // Return because `start` calls makeNextBotMove.
      return;
    }

    if (this.matchHasEnded) {
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
      const userId = meta.players.allIds[userIndex]!;
      const { isBot, itsYourTurn } = meta.players.byId[userId]!;

      if (isBot && itsYourTurn) {
        let boardRepr: string | undefined = undefined;
        if (this._logBoardToTrainingLog && game.logBoard) {
          boardRepr = game.logBoard({ board, playerboards });

          this.logger?.debug?.({ userId, board: boardRepr }, "turn");
        }

        const t0 = new Date().getTime();
        const agent = this._agents[userId];

        let botMove: BotMove<G> | undefined = undefined;

        const args = {
          board,
          playerboard: playerboards[userId]!,
          secretboard,
          userId,
          random,
          withInfo: this._training,
        };

        if (autoMove) {
          // No await because currently `autoMove` is not async.
          botMove = autoMove(args);
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
            "The same bot played too many times in a row. Did you forget to call `turns.end(...)`?",
          );
        }

        // We only play one bot move per call. The function will be called again if it's
        // another bot's turn after.
        this.makeMove(
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

  /*
   * With this function we simulate passing time and execute delayedUpdates
   *
   * delta: time that passed in milli-seconds
   */
  fastForward(delta: number): void {
    this.logger?.debug?.({ delta }, "fastForward");
    const { delayedMoves } = this;

    if (delayedMoves.length === 0) {
      this.time += delta;
      return;
    }

    // Fast forward in increments, according to the delay moves that we have in store.
    // Otherwise they might happen at the wrong timestamp.
    const nextDelayedMove = this.delayedMoves[0]!;

    const { ts } = nextDelayedMove;
    const timeToNextDelayedMove = ts - this.time;

    const shouldExecute = timeToNextDelayedMove <= delta;

    if (shouldExecute) {
      // Move the `time` to that delayed move's execution time.
      this.time = ts;

      // Remove the move
      this.delayedMoves.shift();

      // Execute the delayed move.
      {
        const { type, name, payload, userId } = nextDelayedMove;
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

      // Keep fast-forwarding
      const newDelta = delta - timeToNextDelayedMove;
      if (newDelta > 0) {
        this.fastForward(delta - timeToNextDelayedMove);
      }
    } else {
      this.time += delta;
    }

    this.logger?.debug?.(
      { time: this.time, numDelayedMovesLeft: this.delayedMoves.length },
      "fastForward done",
    );
  }

  get botTrainingLog() {
    return this._botTrainingLog;
  }
}

function sortDelayedMoves(delayedMoves: DelayedMove[]): void {
  delayedMoves.sort((a, b) => a.ts - b.ts);
}
