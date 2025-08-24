import { enablePatches, produceWithPatches } from "immer";
import { expect, test } from "vitest";

import { separatePatchesByUser } from "./backend";

enablePatches();

/* Compare two arrays, ignoring order. */
function expectArraysEqual<T>(a: T[], b: T[]) {
  expect(a.length).toBe(b.length);
  for (const aa of a) {
    expect(b).toContainEqual(aa);
  }
}

test("separatePatchesByUser", () => {
  const matchState = {
    board: { x: 123 },
    playerboards: {
      user1: { x: 123 },
      user2: { x: 123 },
    },
  };

  const [, patches] = produceWithPatches(matchState, (draft) => {
    draft.board = { x: 456 };
    draft.playerboards.user1 = { x: 456 };
    draft.playerboards.user2 = { x: 456 };
  });

  expectArraysEqual(patches, [
    {
      op: "replace",
      path: ["playerboards", "user1"],
      value: { x: 456 },
    },
    {
      op: "replace",
      path: ["playerboards", "user2"],
      value: { x: 456 },
    },
    {
      op: "replace",
      path: ["board"],
      value: { x: 456 },
    },
  ]);

  {
    const patchesByUser = {
      user1: [],
      user2: [],
      spectator: [],
    };

    separatePatchesByUser({
      patches,
      userIds: ["user1", "user2"],
      patchesOut: patchesByUser,
    });

    expectArraysEqual(patchesByUser["user1"], [
      {
        op: "replace",
        path: ["board"],
        value: { x: 456 },
      },
      {
        op: "replace",
        path: ["playerboard"],
        value: { x: 456 },
      },
    ]);

    expectArraysEqual(patchesByUser["user2"], [
      {
        op: "replace",
        path: ["board"],
        value: { x: 456 },
      },
      {
        op: "replace",
        path: ["playerboard"],
        value: { x: 456 },
      },
    ]);

    expectArraysEqual(patchesByUser["spectator"], [
      {
        op: "replace",
        path: ["board"],
        value: { x: 456 },
      },
    ]);
  }
});
