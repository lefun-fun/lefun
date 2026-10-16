import { describe, expect, test } from "vitest";

import { fisherYates } from "./fisherYates";

const mathRandomBelow = (n: number) => Math.floor(Math.random() * n);

describe("fisherYates", () => {
  test("always drawing 0 leaves the array as is", () => {
    const array = [1, 2, 3, 4];
    fisherYates(array, () => 0);
    expect(array).toEqual([1, 2, 3, 4]);
  });

  test("always drawing the last index", () => {
    const array = [1, 2, 3, 4];
    fisherYates(array, (n) => n - 1);
    expect(array).toEqual([4, 1, 2, 3]);
  });

  test("asks for the right ranges", () => {
    const ns: number[] = [];
    fisherYates([1, 2, 3, 4], (n) => {
      ns.push(n);
      return 0;
    });
    expect(ns).toEqual([4, 3, 2]);
  });

  test("count limits the draws", () => {
    const ns: number[] = [];
    fisherYates(
      [1, 2, 3, 4],
      (n) => {
        ns.push(n);
        return 0;
      },
      2,
    );
    expect(ns).toEqual([4, 3]);
  });

  test("empty and single arrays", () => {
    const empty: number[] = [];
    fisherYates(empty, mathRandomBelow);
    expect(empty).toEqual([]);

    const single = [1];
    fisherYates(single, mathRandomBelow);
    expect(single).toEqual([1]);
  });

  test("all permutations are equally likely", () => {
    const n = 60000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const array = ["a", "b", "c"];
      fisherYates(array, mathRandomBelow);
      const key = array.join("");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(Object.keys(counts).length).toBe(6);
    for (const count of Object.values(counts)) {
      expect(Math.abs(count - n / 6)).toBeLessThan(n / 60);
    }
  });

  test("partial: all ordered pairs are equally likely", () => {
    const n = 60000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const array = ["a", "b", "c", "d"];
      fisherYates(array, mathRandomBelow, 2);
      const key = array.slice(0, 2).join("");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(Object.keys(counts).length).toBe(12);
    for (const count of Object.values(counts)) {
      expect(Math.abs(count - n / 12)).toBeLessThan(n / 60);
    }
  });
});
