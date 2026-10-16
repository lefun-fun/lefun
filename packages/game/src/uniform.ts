/*
 * Uniform numbers from a source of uniform 32-bit unsigned integers.
 */

// Integer in [0, n). Rejection sampling, to avoid the modulo bias.
export function randomBelow(uint32: () => number, n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2 ** 32) {
    throw new RangeError(`invalid range size: ${n}`);
  }
  const limit = 2 ** 32 - (2 ** 32 % n);
  let x: number;
  do {
    x = uint32();
  } while (x >= limit);
  return x % n;
}

// Float in [0, 1), using all 53 bits of the mantissa.
export function randomFloat(uint32: () => number): number {
  const high = uint32() >>> 5;
  const low = uint32() >>> 6;
  return (high * 2 ** 26 + low) / 2 ** 53;
}
