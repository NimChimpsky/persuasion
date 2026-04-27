export function assert(condition: unknown, message = "Assertion failed"): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertExists<T>(
  value: T | null | undefined,
  message = "Expected value to exist",
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function assertArrayEquals<T>(actual: T[], expected: T[]): void {
  assertEquals(JSON.stringify(actual), JSON.stringify(expected));
}
