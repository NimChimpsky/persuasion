import { getCreditPackage } from "./credit_packages.ts";
import { assertEquals, assertExists } from "./test_assert.ts";

Deno.test("credit package lookup returns configured packages", () => {
  const pkg = assertExists(getCreditPackage(100));
  assertEquals(pkg.credits, 100);
  assertEquals(pkg.priceUsdCents, 100);
});

Deno.test("credit package lookup rejects unknown packages", () => {
  assertEquals(getCreditPackage(123), null);
});
