import {
  consumeStoredMagicToken,
  isMagicTokenExpired,
  MAGIC_TOKEN_TTL_MS,
} from "./magic_token.ts";
import { assert, assertEquals } from "../shared/test_assert.ts";

function createTokenStore(commitOk: boolean) {
  const deletedKeys: Deno.KvKey[] = [];
  let committed = false;
  return {
    deletedKeys,
    get committed() {
      return committed;
    },
    store: {
      delete(key: Deno.KvKey) {
        deletedKeys.push(key);
        return Promise.resolve();
      },
      atomic() {
        return {
          check() {
            return {
              delete(key: Deno.KvKey) {
                deletedKeys.push(key);
                return {
                  commit() {
                    committed = true;
                    return Promise.resolve({ ok: commitOk });
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

Deno.test("magic token expiry allows fresh tokens", () => {
  const now = Date.parse("2026-01-01T01:00:00.000Z");
  assertEquals(
    isMagicTokenExpired(
      { createdAt: new Date(now - MAGIC_TOKEN_TTL_MS + 1).toISOString() },
      now,
    ),
    false,
  );
});

Deno.test("magic token expiry rejects old or invalid timestamps", () => {
  const now = Date.parse("2026-01-01T01:00:00.000Z");
  assert(
    isMagicTokenExpired(
      { createdAt: new Date(now - MAGIC_TOKEN_TTL_MS - 1).toISOString() },
      now,
    ),
  );
  assert(isMagicTokenExpired({ createdAt: "not-a-date" }, now));
});

Deno.test("magic token consume returns email once and deletes atomically", async () => {
  const now = Date.parse("2026-01-01T01:00:00.000Z");
  const fake = createTokenStore(true);

  const email = await consumeStoredMagicToken(
    fake.store,
    ["magic_tokens", "token"],
    {
      key: ["magic_tokens", "token"],
      value: {
        email: "person@example.com",
        createdAt: new Date(now).toISOString(),
      },
      versionstamp: "00000000000000010000",
    },
    now,
  );

  assertEquals(email, "person@example.com");
  assert(fake.committed);
  assertEquals(fake.deletedKeys.length, 1);
});

Deno.test("magic token consume rejects already-used atomic entries", async () => {
  const now = Date.parse("2026-01-01T01:00:00.000Z");
  const fake = createTokenStore(false);

  const email = await consumeStoredMagicToken(
    fake.store,
    ["magic_tokens", "token"],
    {
      key: ["magic_tokens", "token"],
      value: {
        email: "person@example.com",
        createdAt: new Date(now).toISOString(),
      },
      versionstamp: "00000000000000010000",
    },
    now,
  );

  assertEquals(email, null);
  assert(fake.committed);
});
