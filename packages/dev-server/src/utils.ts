/*
 * Deep copy an object.
 */
export function deepCopy<T>(obj: T): T {
  if (obj === undefined) {
    return obj;
  }

  return JSON.parse(JSON.stringify(obj));
}

let _counter = 0;
export function generateId() {
  return `${new Date().getTime()}-${_counter++}`;
}
