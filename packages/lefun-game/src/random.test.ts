import { describe, expect, test } from "vitest";

import { Random } from ".";

describe("Random", () => {
  const random = new Random();
  test("bernouilli no args", () => {
    random.bernoulli();
  });

  test("bernoulli predictable", () => {
    expect(random.bernoulli(0.0000000000000001)).toBe(false);
    expect(random.bernoulli(0.9999999999999999)).toBe(true);
  });

  test("bernoulli n", () => {
    const n = random.bernoulli(0.3, 1000);
    // Count the number of `true`. It should be around 300.
    expect(n.filter((x) => x).length).toBeGreaterThan(200);
    expect(n.filter((x) => x).length).toBeLessThan(400);
  });

  test("dice no n", () => {
    expect(random.dice(6)).toBeTypeOf("number");
  });

  test("dice with n", () => {
    const value = random.dice(6, 3);
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(3);
  });

  test("d6 no args", () => {
    expect(random.d6()).toBeTypeOf("number");
  });

  test("d6 no args", () => {
    const value = random.d6(2);
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(2);
  });
});
