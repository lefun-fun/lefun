import { sample, sampleSize, shuffle } from "lodash-es";

export class Random {
  shuffled<T>(array: readonly T[]): T[] {
    // Use loadash for this one.
    return shuffle(array);
  }

  sample<T>(array: readonly T[]): T;
  sample<T>(array: readonly T[], { size }: { size: number }): T[];
  sample<T>(array: readonly T[], { size }: { size?: number } = {}): T[] | T {
    if (array.length === 0) {
      throw new Error("can not sample from empty array");
    }
    if (size === undefined) {
      const item = sample(array);
      if (item === undefined) {
        throw new Error("lodash sample returned undefined");
      }
      return item;
    }
    return sampleSize(array, size);
  }

  dice(n: number): number;
  dice(n: number, arg1: { size: number }): number[];
  dice(n: number, { size }: { size?: number } = {}): number | number[] {
    if (size === undefined) {
      return this.randomInt(1, n + 1);
    }
    return this.randomInt(1, n + 1, { size });
  }

  d6(): number;
  d6(arg0: { size: number }): number[];
  d6({ size }: { size?: number } = {}): number | number[] {
    if (size === undefined) {
      return this.dice(6);
    }
    return this.dice(6, { size });
  }

  randomInt(max: number): number;
  randomInt(min: number, max: number): number;
  randomInt(min: number, max: number, { size }: { size: number }): number[];
  randomInt(max: number, { size }: { size: number }): number[];
  randomInt(
    arg0: number,
    arg1?: number | { size: number },
    arg2?: { size: number },
  ): number | number[] {
    let min: number;
    let max: number;

    if (typeof arg1 !== "number") {
      min = 0;
      max = arg0;
    } else {
      min = arg0;
      max = arg1;
    }

    let size = 1;
    let many = false;
    if (typeof arg1 === "object" && typeof arg1.size === "number") {
      size = arg1.size;
      many = true;
    } else if (typeof arg2 === "object" && typeof arg2.size === "number") {
      size = arg2.size;
      many = true;
    }

    const values = Array(size)
      .fill(undefined)
      .map(() => Math.floor(Math.random() * (max - min)) + min);

    if (!many) {
      const first = values[0];
      if (first === undefined) {
        throw new Error("randomInt returned undefined");
      }
      return first;
    }

    return values;
  }

  uniform(): number;
  uniform(arg0: { size: number }): number[];
  uniform({ size }: { size?: number } = {}): number | number[] {
    if (size === undefined) {
      return Math.random();
    }
    return Array(size)
      .fill(undefined)
      .map(() => Math.random());
  }

  bernoulli(p?: number): boolean;
  bernoulli(p: number, arg1: { size: number }): boolean[];
  bernoulli(
    p: number = 0.5,
    { size }: { size?: number } = {},
  ): boolean | boolean[] {
    if (size === undefined) {
      return this.uniform() < p;
    }
    return Array(size)
      .fill(undefined)
      .map(() => this.uniform() < p);
  }
}

/*
 * Testing utils
 */

export class RandomMock extends Random {
  nextValues: any[];
  nextIndex: number;

  constructor() {
    super();

    this.nextValues = [];
    this.nextIndex = 0;

    for (const key of Object.getOwnPropertyNames(Random.prototype)) {
      const original = (this as any)[key];
      if (typeof original === "function" && key !== "constructor") {
        (this as any)[key] = (...args: any[]) => {
          if (this.nextValues.length) {
            return this.nextValues.shift();
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return original.apply(this, args);
        };
      }
    }
  }

  // Backward compatibility
  next(value: any): void {
    this.setNextValues([value]);
  }

  setNextValues(values: readonly any[]) {
    this.nextValues = [...this.nextValues, ...values];
  }
}
