import type { UserId } from "@lefun/core";

export const parseTurnUserIds = (
  userIds: UserId | UserId[] | "all",
  { allUserIds }: { allUserIds: UserId[] },
): UserId[] => {
  if (userIds === "all") {
    userIds = allUserIds;
  }
  if (!Array.isArray(userIds)) {
    userIds = [userIds];
  }
  return userIds;
};

/*
 * 'move' | ['move', payload] => {name: 'move', payload}
 */
export function parseMove<M extends string | [string, any]>(
  move: M,
): {
  name: string;
  payload: M extends string
    ? undefined
    : M extends [string, infer PP]
      ? PP
      : never;
} {
  if (typeof move === "string") {
    return { name: move, payload: undefined } as any;
  }
  const [name, payload] = move;
  return { name, payload };
}

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
