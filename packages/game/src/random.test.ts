import { describe, expect, test } from "vitest";

import { Random, RandomMock } from ".";

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
    const n = random.bernoulli(0.3, { size: 1000 });
    // Count the number of `true`. It should be around 300.
    expect(n.filter((x) => x).length).toBeGreaterThan(200);
    expect(n.filter((x) => x).length).toBeLessThan(400);
  });

  test("dice no n", () => {
    expect(random.dice(6)).toBeTypeOf("number");
  });

  test("dice with n", () => {
    const value = random.dice(6, { size: 3 });
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(3);
  });

  test("d6 no args", () => {
    expect(random.d6()).toBeTypeOf("number");
  });

  test("d6 no args", () => {
    const value = random.d6({ size: 2 });
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(2);
  });

  describe("randomInt", () => {
    test("randomIn(min)", () => {
      const values = random.randomInt(3, { size: 100 });
      expect(values.length).toBe(100);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(3);
      }
    });
    test("randomIn(min, max)", () => {
      const values = random.randomInt(2, 4, { size: 100 });
      expect(values.length).toBe(100);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(2);
        expect(value).toBeLessThan(4);
      }
    });
  });
});

describe("RandomMock", () => {
  test("fallback on Random", () => {
    const random = new RandomMock();
    const v1 = random.randomInt(100000);
    const v2 = random.randomInt(100000);
    expect(v1).not.toEqual(v2);
  });

  test("setNextValues happy path", () => {
    const random = new RandomMock();
    random.setNextValues([42, 43, [1, 2]]);
    const v1 = random.randomInt(100000);
    const v2 = random.randomInt(100000);
    const v3 = random.shuffled([1, 2, 3]);
    expect(v1).toBe(42);
    expect(v2).toBe(43);
    expect(v3).toEqual([1, 2]);
  });

  test("overriden methods by children classes ignore `setNextValues`", () => {
    class MyRandom extends RandomMock {
      shuffled<T>(array: readonly T[]): T[] {
        return [...array];
      }
    }

    const random = new MyRandom();
    random.setNextValues([0, 0]);
    const myArray = [1, 2, 3, 4, 5, 6, 7];
    expect(random.shuffled(myArray)).toEqual(myArray);
  });
});
