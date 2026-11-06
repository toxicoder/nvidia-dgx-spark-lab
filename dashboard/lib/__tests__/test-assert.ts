/**
 * Total accessors for test assertions.
 *
 * `noUncheckedIndexedAccess` makes `rows[0]` and `map["k"]` possibly `undefined`.
 * Writing `!` at every assertion would silence the compiler without saying what a
 * test actually expects, and a missing row would surface later as a confusing
 * "cannot read property of undefined". These helpers name the expectation: the
 * slot must hold a value, and the failure message says which one.
 *
 * Lives under `__tests__/` so it is typechecked with the sources and excluded
 * from the coverage denominator, like any other test-only module.
 */

/**
 * Return the element at `index`, failing when the slot is empty.
 * @param items - The collection under test.
 * @param index - Position the test expects to hold a value.
 * @returns The element, narrowed to a non-undefined type.
 * @throws Error When `index` is out of range or holds `undefined`.
 */
export function itemAt<T>(items: readonly T[], index: number): T {
  const value = items.at(index);
  if (value === undefined) {
    throw new Error(`expected an element at index ${index}, found ${items.length} item(s)`);
  }
  return value;
}

/**
 * Return `record[key]`, failing when the key is absent.
 * @param record - The record under test.
 * @param key - Key the test expects to be present.
 * @returns The value, narrowed to a non-undefined type.
 * @throws Error When the key is missing or holds `undefined`.
 */
export function keyIn<T>(record: Readonly<Record<string, T>>, key: string): T {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`expected key ${JSON.stringify(key)} to be present`);
  }
  return value;
}
