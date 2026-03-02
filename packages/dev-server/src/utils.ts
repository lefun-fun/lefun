let _counter = 0;
export function generateId() {
  return `${new Date().getTime()}-${_counter++}`;
}
