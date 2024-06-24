import { sample, sampleSize, shuffle } from "lodash-es";

export class Random {
  shuffled<T>(array: T[]): T[] {
    // Use loadash for this one.
    return shuffle(array);
  }

  sample<T>(array: T[]): T;
  sample<T>(array: T[], n: number): T[];
  sample<T>(array: T[], n?: number) {
    if (array.length === 0) {
      throw new Error("can not sample from empty array");
    }
    if (n == null) {
      const item = sample(array);
      if (item === undefined) {
        throw new Error("lodash sample returned undefined");
      }
      return item;
    }
    return sampleSize(array, n);
  }

  dice(faces: number): number;
  dice(faces: number, n: number): number[];
  dice(faces: number, n?: number) {
    const onlyOne = typeof n === "undefined";
    const dice = Array(onlyOne ? 1 : n)
      .fill(undefined)
      .map(() => 1 + Math.floor(Math.random() * faces));

    if (onlyOne) {
      return dice[0];
    }
    return dice;
  }

  d6(): number;
  d6(n: number): number[];
  d6(n?: number): number | number[] {
    return n === undefined ? this.dice(6) : this.dice(6, n);
  }

  d2(): number;
  d2(n: number): number[];
  d2(n?: number): number | number[] {
    return n === undefined ? this.dice(2) : this.dice(2, n);
  }

  bernoulli(p?: number): boolean;
  bernoulli(p: number, n: number): boolean[];
  bernoulli(p = 0.5, n?: number): boolean | boolean[] {
    const onlyOne = n === undefined;
    const results = Array(onlyOne ? 1 : n)
      .fill(undefined)
      .map(() => Math.random() < p);

    if (onlyOne) {
      return results[0];
    }
    return results;
  }

  coin(): boolean;
  coin(n: number): boolean[];
  coin(n?: number): boolean | boolean[] {
    return n === undefined ? this.bernoulli() : this.bernoulli(0.5, n);
  }
}

/*
 * Testing utils
 */

// Same interface as Random but you can decide what it's going to return.
// TODO Find a cleaner way to write this. There is *a lot* of copy pasting happening.
export class RandomMock extends Random {
  nextValues: any[];
  nextIndex: number;

  // We'll default on that `Random` when no values are set.
  constructor() {
    super();

    this.nextValues = [];
    this.nextIndex = 0;
  }

  shuffled(array: any[]): any[] {
    if (this.nextIndex < this.nextValues.length) {
      return this.nextValues[this.nextIndex++];
    }
    return Random.prototype.shuffled.call(this, array);
  }

  next(value: any): void {
    this.nextValues.push(value);
  }

  d6(): number;
  d6(n: number): number[];
  d6(n?: number): number | number[] {
    if (this.nextIndex < this.nextValues.length) {
      return this.nextValues[this.nextIndex++];
    }
    return n === undefined ? super.d6() : super.d6(n);
  }

  sample<T>(array: T[]): T;
  sample<T>(array: T[], n: number): T[];
  sample<T>(array: T[], n?: number) {
    if (n !== undefined) {
      throw new Error("not implemented yet");
    }
    if (this.nextIndex < this.nextValues.length) {
      return this.nextValues[this.nextIndex++];
    }
    return n === undefined ? super.sample(array) : super.sample(array, n);
  }

  bernoulli(p?: number): boolean;
  bernoulli(p: number, n: number): boolean[];
  bernoulli(p = 0.5, n?: number): boolean | boolean[] {
    if (this.nextIndex < this.nextValues.length) {
      return this.nextValues[this.nextIndex++];
    }
    return n === undefined ? super.bernoulli(p) : super.bernoulli(p, n);
  }
}
