/* Game move execution */

import { enablePatches, Patch, produceWithPatches, setAutoFreeze } from "immer";

import type { Meta, UserId } from "@lefun/core";

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
import { parseMove, parseTurnUserIds } from "./utils";

enablePatches();
setAutoFreeze(false);

export type Stat = {
  key: string;
  value: number;
  userId?: UserId;
};

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

export type ExecuteMoveOutput = {
  matchHasEnded: boolean;
  patches: Patch[];
  error?: string;
  delayedMoves: DelayedMove[];
  beginTurnUsers: Set<UserId>;
  endTurnUsers: Set<UserId>;
  board: unknown;
  playerboards: Record<UserId, unknown>;
  secretboard: unknown;
  stats: Stat[];
};

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
  skipCanDo = false,
  onlyExecuteNow = false,
  meta,
}: {
  name: string;
  payload: unknown;
  game: Game_<GS>;
  userId: UserId;
  board: GS["B"];
  playerboards: Record<UserId, GS["PB"]>;
  secretboard: GS["SB"];
  matchData: unknown;
  gameData: unknown;
  now: number;
  random: Random;
  skipCanDo?: boolean;
  onlyExecuteNow?: boolean;
  meta: Meta;
}) {
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
    !skipCanDo &&
    canDo &&
    !canDo({
      userId,
      board,
      playerboard: userId ? playerboards[userId] : undefined!,
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
          playerboard: playerboards[userId],
          userId,
          payload,
          _: moveSideEffects,
          ...moveSideEffects,
        });
      },
    );
    if (error) {
      throw error;
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
      throw error;
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

type SideEffectResults = {
  matchHasEnded: boolean;
  beginTurnUsers: Set<UserId>;
  endTurnUsers: Set<UserId>;
  delayedMoves: DelayedMove[];
  stats: Stat[];
};

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
    beginTurnUsers: new Set(),
    endTurnUsers: new Set(),
    delayedMoves: [],
    stats: [],
  };

  const endMatch = () => {
    sideEffectResults.matchHasEnded = true;
  };

  const turnsBegin: Turns["begin"] = (
    userIds,
    { expiresIn, playerMoveOnExpire, boardMoveOnExpire } = {},
  ) => {
    let expiresAt: number | undefined = undefined;
    userIds = parseTurnUserIds(userIds, {
      allUserIds: meta.players.allIds,
    });
    for (const userId of userIds) {
      sideEffectResults.beginTurnUsers.add(userId);
      sideEffectResults.endTurnUsers.delete(userId);
    }

    if (expiresIn !== undefined) {
      const ts = now + expiresIn;
      for (const userId of userIds) {
        // We don't do anything for bots, assuming that they will play quickly.
        if (meta.players.byId[userId]?.isBot) {
          // FIXME Add a test for this
          continue;
        }

        if (!playerMoveOnExpire && !boardMoveOnExpire) {
          console.error(
            "move with `expiresIn` requires `playerMoveOnExpire` or `boardMoveOnExpire`",
          );
          continue;
        }

        if (playerMoveOnExpire && boardMoveOnExpire) {
          console.error(
            "turn can not define both `playerMoveOnExpire` and `boardMoveOnExpire`",
          );
          continue;
        }

        const type = playerMoveOnExpire ? "playerMove" : "boardMove";
        const { name, payload } = parseMove(
          (playerMoveOnExpire || boardMoveOnExpire)!,
        );
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
    return { expiresAt };
  };

  const turnsEnd: Turns["end"] = (userIds) => {
    userIds = parseTurnUserIds(userIds, {
      allUserIds: meta.players.allIds,
    });
    for (const userId of userIds) {
      sideEffectResults.endTurnUsers.add(userId);
      sideEffectResults.beginTurnUsers.delete(userId);
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
      end: turnsEnd,
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
}: {
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
}) {
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
    throw error;
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
