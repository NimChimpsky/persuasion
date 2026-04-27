export const MAGIC_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface MagicTokenRecord {
  email: string;
  createdAt: string;
}

type StoredTokenEntry = Deno.KvEntryMaybe<MagicTokenRecord>;

interface MagicTokenStore {
  delete(key: Deno.KvKey): Promise<void>;
  atomic(): {
    check(entry: Deno.AtomicCheck): {
      delete(key: Deno.KvKey): {
        commit(): Promise<{ ok: boolean }>;
      };
    };
  };
}

export function isMagicTokenExpired(
  record: Pick<MagicTokenRecord, "createdAt">,
  now = Date.now(),
): boolean {
  const createdAt = new Date(record.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return now - createdAt > MAGIC_TOKEN_TTL_MS;
}

export async function consumeStoredMagicToken(
  store: MagicTokenStore,
  key: Deno.KvKey,
  entry: StoredTokenEntry,
  now = Date.now(),
): Promise<string | null> {
  if (!entry.value) return null;

  if (isMagicTokenExpired(entry.value, now)) {
    await store.delete(key);
    return null;
  }

  const result = await store.atomic().check(entry).delete(key).commit();
  if (!result.ok) return null;

  return entry.value.email;
}
