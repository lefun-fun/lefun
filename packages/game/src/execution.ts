/* Game move execution */

import { enablePatches, Patch, produceWithPatches, setAutoFreeze } from "immer";

import { Meta, metaBeginTurn, metaEndTurn, UserId } from "@lefun/core";

import {
  BoardExecute,
  Game_,
  GameStateBase,
  INIT_MOVE,
  MATCH_WAS_ABORTED,
  MoveSideEffects,
  Turns,
} from "./gameDef";
import { Random } from "./random";
import { parseMove } from "./utils";

enablePatches();
setAutoFreeze(false);

export type Stat = {
  key: string;
  value: number;
  userId?: UserId;
};

// These moves happen on turn expiration.
type DelayedPlayerMove = {
  type: "playerMove";
  name: string;
  payload: unknown;
  ts: number;
  userId: UserId;
};

// The main different with DelayedPlayerMove is that userId is optional.
type DelayedBoardMove = {
  type: "boardMove";
  name: string;
  payload: unknown;
  ts: number;
  // We still need the `userId` when it's a move that is triggered when the player's turn expires.
  userId?: UserId;
};

export type DelayedMove = DelayedBoardMove | DelayedPlayerMove;

function tryProduceWithPatches<T>(
  input: T,
  func: (arg0: T) => void,
): {
  output: T;
  patches: Patch[];
  retValue: boolean;
  // We'll put the try/catch error in here.
  error: unknown;
} {
  let retValue: any = undefined;
  let error: unknown = undefined;

  const [output, patches] = produceWithPatches<T>(
    // Start from the current board and playerboards.
    input,
    // And modify them with the execute(Now) function.
    (draft) => {
      try {
        // Why do I need `as T ` here?
        retValue = func(draft as T);
      } catch (e) {
        error = e;
      }
    },
  );

  return {
    output,
    patches,
    retValue,
    error,
  };
}

export type MoveExecutionOutput = {
  board: object;
  playerboards: Record<UserId, object | null>;
  secretboard: object | null;
  patches: Patch[];
} & SideEffectResults;

type BoardMoveExecutionInput<GS extends GameStateBase> = {
  name: string;
  payload: unknown;
  game: Game_<GS>;
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"]>;
  secretboard: GS["SB"];
  matchData: unknown;
  gameData: unknown;
  now: number;
  random: Random;
  meta: Meta;
  // Indicates whether the move is being executed because of a turn expiration.
  isExpiration: boolean;
};

type PlayerMoveExecutionInput<GS extends GameStateBase> =
  BoardMoveExecutionInput<GS> & {
    userId: UserId;
    onlyExecuteNow?: boolean;
  };

export function executePlayerMove<GS extends GameStateBase>({
  name,
  payload,
  game,
  userId,
  board,
  playerboards,
  secretboard,
  matchData,
  gameData,
  now,
  random,
  onlyExecuteNow = false,
  meta,
  isExpiration,
}: PlayerMoveExecutionInput<GS>): MoveExecutionOutput {
  // This is a "normal" player move.
  const moveDef = game.playerMoves[name];

  if (!moveDef) {
    throw new Error(`unknown player move: ${name}`);
  }

  if (meta.players.byId[userId] === undefined) {
    throw new Error(`user "${userId}" is not a player`);
  }

  const { canDo, executeNow, execute } = moveDef;

  if (
    canDo &&
    !canDo({
      userId,
      board,
      playerboard: playerboards[userId]!,
      payload,
      ts: now,
    })
  ) {
    throw new Error(`User "${userId}" can not do move "${name}"`);
  }

  const { moveSideEffects, sideEffectResults } = defineMoveSideEffects({
    game,
    meta,
    now,
  });

  // For expiration moves, if the player's turn was not explicitely begun,
  // it means their turn should end.
  if (isExpiration && sideEffectResults.beginTurn[userId] === undefined) {
    sideEffectResults.endTurn[userId] = null;
  }

  const allPatches: Patch[] = [];

  let retValue = true;
  if (executeNow) {
    const {
      output,
      patches,
      error,
      retValue: retValue_,
    } = tryProduceWithPatches(
      { board, playerboards },
      ({ board, playerboards }) => {
        executeNow({
          board,
          playerboard: playerboards[userId]!,
          userId,
          payload,
          _: moveSideEffects,
          ...moveSideEffects,
        });
      },
    );
    if (error) {
      throw error as Error;
    }

    ({ board, playerboards } = output);
    allPatches.push(...patches);
    retValue = retValue_;
  }

  if (execute && retValue !== false && !onlyExecuteNow) {
    const { output, patches, error } = tryProduceWithPatches(
      { board, playerboards, secretboard },
      ({ board, playerboards, secretboard }) => {
        execute({
          board,
          playerboards,
          secretboard,
          matchData,
          gameData,
          userId,
          payload,
          ts: now,
          random,
          _: moveSideEffects,
          ...moveSideEffects,
        });
      },
    );

    if (error) {
      throw error as Error;
    }

    ({ board, playerboards, secretboard } = output);
    allPatches.push(...patches);
  }

  return {
    board,
    playerboards,
    secretboard,
    patches: allPatches,
    ...sideEffectResults,
  };
}

type BeginTurn = Record<UserId, { expiresAt?: number }>;
type EndTurn = Record<UserId, null>;

type SideEffectResults = {
  matchHasEnded: boolean;
  beginTurn: BeginTurn;
  endTurn: EndTurn;
  delayedMoves: DelayedMove[];
  stats: Stat[];
};

const ensureArray = <T>(x: T | T[]): T[] => {
  if (!Array.isArray(x)) {
    x = [x];
  }
  return x;
};

/*
 * Returns the side effects results and the functions that will populate them.
 */
function defineMoveSideEffects<GS extends GameStateBase>({
  game,
  meta,
  now,
}: {
  game: Game_<GS>;
  meta: Meta;
  now: number;
}): { sideEffectResults: SideEffectResults; moveSideEffects: MoveSideEffects } {
  const sideEffectResults: SideEffectResults = {
    matchHasEnded: false,
    beginTurn: {},
    endTurn: {},
    delayedMoves: [],
    stats: [],
  };

  const endMatch = () => {
    sideEffectResults.matchHasEnded = true;
  };

  const endTurnForUser = (userId: UserId) => {
    delete sideEffectResults.beginTurn[userId];
    sideEffectResults.endTurn[userId] = null;

    // Note that this is not very efficient because we need to loop through all
    // delayed moves, and we call this for all users.
    sideEffectResults.delayedMoves.forEach((delayedMove, i) => {
      if (delayedMove.userId === userId) {
        sideEffectResults.delayedMoves.splice(i, 1);
        return false;
      }
    });
  };

  const turnsBegin: Turns["begin"] = (userIds, turnBeginOptions = {}) => {
    const { expiresIn, onExpiration } = turnBeginOptions;

    let expiresAt: number | undefined = undefined;

    userIds = ensureArray(userIds);

    for (const userId of userIds) {
      endTurnForUser(userId);
    }

    if (expiresIn !== undefined) {
      const ts = now + expiresIn;
      for (const userId of userIds) {
        // We don't do anything for bots, assuming that they will play quickly.
        if (meta.players.byId[userId]?.isBot) {
          // FIXME Add a test for this
          continue;
        }

        const { move, type } =
          "playerMove" in onExpiration
            ? { move: onExpiration.playerMove, type: "playerMove" as const }
            : { move: onExpiration.boardMove, type: "boardMove" as const };

        const { name, payload } = parseMove(move);
        sideEffectResults.delayedMoves.push({
          type,
          userId,
          ts,
          name,
          payload,
        });
      }
      expiresAt = ts;
    }

    for (const userId of userIds) {
      sideEffectResults.beginTurn[userId] = { expiresAt };
      delete sideEffectResults.endTurn[userId];
    }

    return { expiresAt };
  };

  const turnsEnd: Turns["end"] = (userIds) => {
    userIds = ensureArray(userIds);
    for (const userId of userIds) {
      endTurnForUser(userId);
    }
  };

  const delayMove = (
    name: string,
    ...rest: [number] | [unknown, number]
  ): { ts: number } => {
    const [payload, delay] = rest.length === 1 ? [undefined, rest[0]] : rest;

    const ts = new Date(now + delay).getTime();

    sideEffectResults.delayedMoves.push({
      type: "boardMove",
      name,
      payload,
      ts,
    });

    return { ts };
  };

  const logPlayerStat = (userId: UserId, key: string, value: number) => {
    if (!game.playerStats?.byId[key]) {
      throw new Error(`player stat "${key}" not defined`);
    }
    sideEffectResults.stats.push({ key, value, userId });
  };

  const logMatchStat = (key: string, value: number) => {
    if (!game.matchStats?.byId[key]) {
      throw new Error(`match stat "${key}" not defined`);
    }
    sideEffectResults.stats.push({ key, value });
  };

  const moveSideEffects: MoveSideEffects = {
    delayMove,
    turns: {
      begin: turnsBegin,
      beginAll: (options) => turnsBegin(meta.players.allIds, options),
      end: turnsEnd,
      endAll: () => turnsEnd(meta.players.allIds),
    },
    endMatch,
    logPlayerStat,
    logMatchStat,
  };

  return { moveSideEffects, sideEffectResults };
}

function getBoardMoveExecuteFunc<GS extends GameStateBase>(
  game: Game_<GS>,
  name: string,
): BoardExecute | undefined {
  const { boardMoves } = game;

  if (boardMoves === undefined || boardMoves[name] === undefined) {
    const optionalMoves = [INIT_MOVE, MATCH_WAS_ABORTED];
    if (!optionalMoves.includes(name)) {
      throw new Error(`unknown board move ${name}`);
    }
    return;
  }

  const moveDef = boardMoves[name];

  const { execute } = moveDef;

  if (!execute) {
    throw new Error(`"execute" function of board move "${name}" not defined`);
  }

  return execute;
}

export function executeBoardMove<GS extends GameStateBase>({
  name,
  payload,
  game,
  board,
  playerboards,
  secretboard,
  matchData,
  gameData,
  now,
  random,
  meta,
}: BoardMoveExecutionInput<GS>): MoveExecutionOutput {
  const execute = getBoardMoveExecuteFunc(game, name);

  const { moveSideEffects, sideEffectResults } = defineMoveSideEffects({
    game,
    meta,
    now,
  });

  const { output, patches, error } = tryProduceWithPatches(
    { board, playerboards, secretboard },
    ({ board, playerboards, secretboard }) => {
      if (!execute) {
        return;
      }
      execute({
        board,
        playerboards,
        secretboard,
        matchData,
        gameData,
        payload,
        ts: now,
        random,
        _: moveSideEffects,
        ...moveSideEffects,
      });
    },
  );

  if (error) {
    throw error as Error;
  }

  ({ board, playerboards, secretboard } = output);

  return {
    board,
    playerboards,
    secretboard,
    patches,
    ...sideEffectResults,
  };
}

export function updateMetaWithTurnInfo({
  meta,
  beginTurn,
  endTurn,
  now,
}: {
  meta: Meta;
  beginTurn: BeginTurn;
  endTurn: EndTurn;
  now: number;
}): { meta: Meta; patches: Patch[] } {
  const [newMeta, metaPatches] = produceWithPatches<{ meta: Meta }>(
    // Wrap `meta` in an object to to be able to merge with the board patches.
    { meta },
    (draft: { meta: Meta }) => {
      const { meta } = draft;

      for (const [userId, { expiresAt }] of Object.entries(beginTurn)) {
        metaBeginTurn({
          meta,
          beginsAt: now,
          userId,
          expiresAt,
        });
      }

      for (const userId of Object.keys(endTurn)) {
        metaEndTurn({
          meta,
          userId,
        });
      }
    },
  );

  return { meta: newMeta.meta, patches: metaPatches };
}
