import { isValidEmail, normalizeEmail, normalizeGender } from "./validation.ts";
import { assert, assertEquals } from "./test_assert.ts";

Deno.test("email validation normalizes and validates basic addresses", () => {
  assertEquals(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert(isValidEmail("user@example.com"));
  assert(!isValidEmail("not-an-email"));
});

Deno.test("gender normalization falls back for unknown values", () => {
  assertEquals(normalizeGender("FEMALE"), "female");
  assertEquals(normalizeGender("wat"), "male");
  assertEquals(normalizeGender("wat", "non-binary"), "non-binary");
});
