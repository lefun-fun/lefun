import { describe, expect, test } from "vitest";

import { randomBelow, randomFloat } from "./uniform";

const MAX = 2 ** 32 - 1;

// A source that returns `values` in order, and counts the draws.
function scripted(values: number[]) {
  const source = { draws: 0, uint32: () => values[source.draws++]! };
  return source;
}

describe("randomBelow", () => {
  test("reduces modulo n", () => {
    expect(randomBelow(scripted([7]).uint32, 3)).toBe(1);
  });

  test("rejects the values that would bias the result", () => {
    // 2^32 % 3 === 1: the very last value is the only one rejected.
    const source = scripted([MAX, MAX - 1]);
    expect(randomBelow(source.uint32, 3)).toBe((MAX - 1) % 3);
    expect(source.draws).toBe(2);
  });

  test("never rejects when n divides 2^32", () => {
    const source = scripted([MAX]);
    expect(randomBelow(source.uint32, 2 ** 32)).toBe(MAX);
    expect(randomBelow(scripted([MAX]).uint32, 4)).toBe(3);
    expect(source.draws).toBe(1);
  });

  test("rejects invalid ranges", () => {
    const { uint32 } = scripted([0]);
    expect(() => randomBelow(uint32, 0)).toThrow();
    expect(() => randomBelow(uint32, 2.5)).toThrow();
    expect(() => randomBelow(uint32, 2 ** 32 + 1)).toThrow();
  });
});

describe("randomFloat", () => {
  test("extremes", () => {
    expect(randomFloat(scripted([0, 0]).uint32)).toBe(0);
    expect(randomFloat(scripted([MAX, MAX]).uint32)).toBe(1 - 2 ** -53);
  });

  test("uses two draws", () => {
    const source = scripted([0, 0]);
    randomFloat(source.uint32);
    expect(source.draws).toBe(2);
  });
});
