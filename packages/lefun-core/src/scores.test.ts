import { expect, test } from "vitest";

import { getRanks } from "./scores";

test.each([
  [
    { 0: 10, 1: 9, 2: 8 },
    { 0: 0, 1: 1, 2: 2 },
  ],
  [
    { 0: 10, 1: 10, 2: 8, 3: 7 },
    { 0: 0, 1: 0, 2: 2, 3: 3 },
  ],
  [
    { 0: 9, 1: 9, 2: 10, 3: 7 },
    { 2: 0, 0: 1, 1: 1, 3: 3 },
  ],
  [
    { 0: 10, 1: 10, 2: 10, 3: 10 },
    { 0: 0, 1: 0, 2: 0, 3: 0 },
  ],
  [
    { 0: 1, 1: 1, 2: 2, 3: 2 },
    { 2: 0, 3: 0, 0: 2, 1: 2 },
  ],
  [
    { 0: 10, 1: 9 },
    { 0: 0, 1: 1 },
  ],
  [{ 0: 10 }, { 0: 0 }],
  [
    { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 5 },
    { 5: 0, 6: 0, 4: 2, 3: 3, 2: 4, 1: 5, 0: 6 },
  ],
  [{ 0: 10 }, { 0: 0 }],
  [{}, {}],
  [
    { 0: 10, 1: 5, 2: 5, 3: 3, 4: 3, 5: 0 },
    { 0: 0, 1: 1, 2: 1, 3: 3, 4: 3, 5: 5 },
  ],
  [
    { 0: 10, 1: NaN, 2: Infinity, 3: -Infinity, 5: 4 },
    { 0: 0, 5: 1 },
  ],
  [{ 0: NaN }, {}],
  [{ 0: NaN, 1: NaN }, {}],
  [{ 0: Infinity }, {}],
  [{ 0: -Infinity }, {}],
])(
  "getRanks %s %s",
  (scores: Record<string, number>, ranks: Record<string, number>) => {
    // Our function works on `match.meta`, so let's make up one from the points.
    expect(getRanks({ scores, scoreType: "integer" })).toEqual(ranks);
  },
);
