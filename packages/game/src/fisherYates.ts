/*
 * Fisher-Yates shuffle, in place.
 *
 * Only the first `count` positions are drawn, which is enough to take a uniform sample
 * of `count` elements: they end up at the start of the array.
 *
 * `randomBelow(n)` must return a uniform integer in [0, n).
 */
export function fisherYates<T>(
  array: T[],
  randomBelow: (n: number) => number,
  count: number = array.length,
): void {
  const n = array.length;
  for (let i = 0; i < Math.min(count, n - 1); i++) {
    const j = i + randomBelow(n - i);
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}
