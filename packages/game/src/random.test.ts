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

describe("Random seed", () => {
  test("empty seed is refused", () => {
    expect(() => new Random({ seed: "" })).toThrow("empty seed");
  });

  test("same seed, same sequence", () => {
    const a = new Random({ seed: "abc" });
    const b = new Random({ seed: "abc" });
    // More than one buffer's worth.
    expect(a.randomInt(1000, { size: 3000 })).toEqual(
      b.randomInt(1000, { size: 3000 }),
    );
  });

  test("different seeds, different sequences", () => {
    const a = new Random({ seed: "abc" });
    const b = new Random({ seed: "abd" });
    expect(a.uniform({ size: 10 })).not.toEqual(b.uniform({ size: 10 }));
  });

  test("no seed, different sequences", () => {
    expect(new Random().uniform({ size: 10 })).not.toEqual(
      new Random().uniform({ size: 10 }),
    );
  });

  test("the sequence for a seed does not change", () => {
    const random = new Random({ seed: "lefun" });
    expect(random.randomInt(1000, { size: 5 })).toMatchInlineSnapshot(`
      [
        74,
        383,
        279,
        613,
        202,
      ]
    `);
    expect(random.shuffled([1, 2, 3, 4, 5, 6])).toMatchInlineSnapshot(`
      [
        3,
        2,
        5,
        6,
        4,
        1,
      ]
    `);
    expect(random.uniform()).toMatchInlineSnapshot(`0.8981173788810053`);
  });
});

describe("Random distributions", () => {
  const random = new Random();

  test("uniform is in [0, 1)", () => {
    for (const x of random.uniform({ size: 10000 })) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  test("randomInt rejects non-integers and empty ranges", () => {
    expect(() => random.randomInt(2.5)).toThrow();
    expect(() => random.randomInt(0)).toThrow();
    expect(() => random.randomInt(3, 3)).toThrow();
  });

  test("shuffled is a permutation and leaves its input alone", () => {
    const array = [1, 2, 3, 4, 5];
    const shuffled = random.shuffled(array);
    expect(array).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual(array);
  });

  test("sample with size", () => {
    const values = random.sample([1, 2, 3, 4, 5], { size: 3 });
    expect(values.length).toBe(3);
    expect(new Set(values).size).toBe(3);
    expect(random.sample([1, 2], { size: 5 }).sort()).toEqual([1, 2]);
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
