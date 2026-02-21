import { getKv } from "./kv.ts";
import { parseTranscript } from "../shared/transcript.ts";
import type {
  AssistantConfig,
  GameConfig,
  GameIndexEntry,
  TranscriptEvent,
  UserGender,
  UserProfile,
  UserProgress,
} from "../shared/types.ts";

const USER_PROGRESS_META_PREFIX = ["user_progress_meta"] as const;
const USER_PROGRESS_CHUNK_PREFIX = ["user_progress_chunk"] as const;
const USER_PROFILE_PREFIX = ["user_profile"] as const;
const GLOBAL_ASSISTANT_KEY = ["global_assistant_config"] as const;
const PROGRESS_STORAGE_VERSION = "chunks_v1";
const PROGRESS_CODEC = "gzip";
const CHUNK_EVENT_SIZE = 80;
const SAVE_RETRY_LIMIT = 3;
const VALID_GENDERS: ReadonlySet<UserGender> = new Set([
  "male",
  "female",
  "non-binary",
]);

interface UserProgressMeta {
  version: typeof PROGRESS_STORAGE_VERSION;
  codec: typeof PROGRESS_CODEC;
  chunkEventSize: number;
  chunkCount: number;
  eventCount: number;
  updatedAt: string;
  gameSnapshot?: UserProgress["gameSnapshot"];
}

interface UserProgressChunk {
  index: number;
  eventCount: number;
  data: Uint8Array;
}

function metaKey(email: string, slug: string): Deno.KvKey {
  return [...USER_PROGRESS_META_PREFIX, email, slug];
}

function chunkPrefix(email: string, slug: string): Deno.KvKey {
  return [...USER_PROGRESS_CHUNK_PREFIX, email, slug];
}

function chunkKey(email: string, slug: string, index: number): Deno.KvKey {
  return [...USER_PROGRESS_CHUNK_PREFIX, email, slug, index];
}

function normalizeProfileEmail(email: string): string {
  return email.trim().toLowerCase();
}

function profileKey(email: string): Deno.KvKey {
  return [...USER_PROFILE_PREFIX, normalizeProfileEmail(email)];
}

function parseUserGender(value: string): UserGender | null {
  const gender = value.trim().toLowerCase();
  return VALID_GENDERS.has(gender as UserGender) ? gender as UserGender : null;
}

function serializeEventsToJsonl(events: TranscriptEvent[]): string {
  if (events.length === 0) return "";
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function parseJsonlChunk(text: string): TranscriptEvent[] {
  return parseTranscript(text);
}

function chunkEvents(
  events: TranscriptEvent[],
  chunkEventSize: number,
): TranscriptEvent[][] {
  const chunks: TranscriptEvent[][] = [];
  for (let i = 0; i < events.length; i += chunkEventSize) {
    chunks.push(events.slice(i, i + chunkEventSize));
  }
  return chunks;
}

async function compressTextGzip(text: string): Promise<Uint8Array> {
  const stream = new Response(text).body?.pipeThrough(
    new CompressionStream(PROGRESS_CODEC),
  );
  if (!stream) return new Uint8Array();
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressTextGzip(bytes: Uint8Array): Promise<string> {
  const normalized = new Uint8Array(bytes);
  const stream = new Response(normalized).body?.pipeThrough(
    new DecompressionStream(PROGRESS_CODEC),
  );
  if (!stream) return "";
  return await new Response(stream).text();
}

async function readAllChunkEntries(
  kv: Deno.Kv,
  email: string,
  slug: string,
): Promise<Array<Deno.KvEntryMaybe<UserProgressChunk>>> {
  const entries: Array<Deno.KvEntryMaybe<UserProgressChunk>> = [];
  for await (
    const entry of kv.list<UserProgressChunk>({
      prefix: chunkPrefix(email, slug),
    })
  ) {
    entries.push(entry);
  }
  entries.sort((a, b) => {
    const ai = Number(a.key[a.key.length - 1] ?? 0);
    const bi = Number(b.key[b.key.length - 1] ?? 0);
    return ai - bi;
  });
  return entries;
}

async function buildCompressedChunk(
  index: number,
  events: TranscriptEvent[],
): Promise<UserProgressChunk> {
  const jsonl = serializeEventsToJsonl(events);
  return {
    index,
    eventCount: events.length,
    data: await compressTextGzip(jsonl),
  };
}

async function writeFullProgress(
  kv: Deno.Kv,
  email: string,
  slug: string,
  progress: UserProgress,
  currentMetaEntry: Deno.KvEntryMaybe<UserProgressMeta> | null,
): Promise<void> {
  const allEvents = parseTranscript(progress.transcript);
  const eventChunks = chunkEvents(allEvents, CHUNK_EVENT_SIZE);
  const newChunks = await Promise.all(
    eventChunks.map((events, index) => buildCompressedChunk(index, events)),
  );

  const existingChunkEntries = await readAllChunkEntries(kv, email, slug);
  let op = kv.atomic();
  if (currentMetaEntry) {
    op = op.check(currentMetaEntry);
  } else {
    op = op.check({ key: metaKey(email, slug), versionstamp: null });
  }

  for (const entry of existingChunkEntries) {
    op = op.delete(entry.key);
  }
  for (const chunk of newChunks) {
    op = op.set(chunkKey(email, slug, chunk.index), chunk);
  }

  const nextMeta: UserProgressMeta = {
    version: PROGRESS_STORAGE_VERSION,
    codec: PROGRESS_CODEC,
    chunkEventSize: CHUNK_EVENT_SIZE,
    chunkCount: newChunks.length,
    eventCount: allEvents.length,
    updatedAt: progress.updatedAt,
    gameSnapshot: progress.gameSnapshot,
  };
  op = op.set(metaKey(email, slug), nextMeta);

  const committed = await op.commit();
  if (!committed.ok) {
    throw new Error("user_progress_conflict");
  }
}

async function appendProgressDelta(
  kv: Deno.Kv,
  email: string,
  slug: string,
  progress: UserProgress,
  metaEntry: Deno.KvEntryMaybe<UserProgressMeta>,
): Promise<void> {
  const meta = metaEntry.value;
  if (!meta) throw new Error("missing_progress_meta");

  const allEvents = parseTranscript(progress.transcript);
  if (allEvents.length < meta.eventCount) {
    await writeFullProgress(kv, email, slug, progress, metaEntry);
    return;
  }

  const deltaEvents = allEvents.slice(meta.eventCount);
  if (deltaEvents.length === 0) {
    const op = kv.atomic()
      .check(metaEntry)
      .set(metaKey(email, slug), {
        ...meta,
        updatedAt: progress.updatedAt,
        gameSnapshot: progress.gameSnapshot,
      } as UserProgressMeta);
    const committed = await op.commit();
    if (!committed.ok) {
      throw new Error("user_progress_conflict");
    }
    return;
  }

  const tailIndex = Math.max(0, meta.chunkCount - 1);
  const tailEntry = meta.chunkCount > 0
    ? await kv.get<UserProgressChunk>(chunkKey(email, slug, tailIndex))
    : null;

  let carryEvents = deltaEvents;
  let nextChunkIndex = meta.chunkCount;
  const chunksToWrite: UserProgressChunk[] = [];

  if (tailEntry?.value) {
    const tailText = await decompressTextGzip(tailEntry.value.data);
    const tailEvents = parseJsonlChunk(tailText);
    const capacity = Math.max(0, CHUNK_EVENT_SIZE - tailEvents.length);
    const mergeEvents = carryEvents.slice(0, capacity);
    carryEvents = carryEvents.slice(mergeEvents.length);

    if (mergeEvents.length > 0) {
      const merged = [...tailEvents, ...mergeEvents];
      chunksToWrite.push(await buildCompressedChunk(tailIndex, merged));
    }
  }

  if (carryEvents.length > 0) {
    const newChunks = chunkEvents(carryEvents, CHUNK_EVENT_SIZE);
    for (const chunkEventsPart of newChunks) {
      chunksToWrite.push(
        await buildCompressedChunk(nextChunkIndex, chunkEventsPart),
      );
      nextChunkIndex++;
    }
  }

  const opBase = kv.atomic().check(metaEntry);
  let op = opBase;
  for (const chunk of chunksToWrite) {
    op = op.set(chunkKey(email, slug, chunk.index), chunk);
  }

  const nextMeta: UserProgressMeta = {
    ...meta,
    updatedAt: progress.updatedAt,
    gameSnapshot: progress.gameSnapshot,
    eventCount: allEvents.length,
    chunkCount: Math.max(meta.chunkCount, nextChunkIndex),
  };
  op = op.set(metaKey(email, slug), nextMeta);

  const committed = await op.commit();
  if (!committed.ok) {
    throw new Error("user_progress_conflict");
  }
}

export async function getGameBySlug(slug: string): Promise<GameConfig | null> {
  const kv = await getKv();
  const entry = await kv.get<GameConfig>(["games_by_slug", slug]);
  return entry.value;
}

export async function listGames(): Promise<GameIndexEntry[]> {
  const kv = await getKv();
  const games: GameIndexEntry[] = [];

  for await (
    const entry of kv.list<GameIndexEntry>({ prefix: ["games_index"] })
  ) {
    if (entry.value.active) {
      games.push(entry.value);
    }
  }

  return games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createGame(game: GameConfig): Promise<void> {
  const kv = await getKv();
  const index: GameIndexEntry = {
    slug: game.slug,
    title: game.title,
    active: game.active,
    characterCount: game.characters.length,
    updatedAt: game.updatedAt,
  };

  const result = await kv.atomic()
    .check({ key: ["games_by_slug", game.slug], versionstamp: null })
    .set(["games_by_slug", game.slug], game)
    .set(["games_index", game.slug], index)
    .commit();

  if (!result.ok) {
    throw new Error("game_slug_exists");
  }
}

export async function deleteGameBySlug(slug: string): Promise<boolean> {
  const kv = await getKv();
  const existing = await kv.get<GameConfig>(["games_by_slug", slug]);
  if (!existing.value) return false;

  const result = await kv.atomic()
    .check(existing)
    .delete(["games_by_slug", slug])
    .delete(["games_index", slug])
    .commit();

  return result.ok;
}

export async function getGlobalAssistantConfig(): Promise<AssistantConfig | null> {
  const kv = await getKv();
  const entry = await kv.get<AssistantConfig>(GLOBAL_ASSISTANT_KEY);
  return entry.value;
}

export async function setGlobalAssistantConfig(config: AssistantConfig): Promise<void> {
  const kv = await getKv();
  await kv.set(GLOBAL_ASSISTANT_KEY, config);
}

export async function getUserProfile(
  email: string,
): Promise<UserProfile | null> {
  const kv = await getKv();
  const entry = await kv.get<UserProfile>(profileKey(email));
  return entry.value;
}

export async function upsertUserProfile(
  email: string,
  input: { name: string; gender: string },
): Promise<UserProfile> {
  const normalizedEmail = normalizeProfileEmail(email);
  const name = input.name.trim();
  const gender = parseUserGender(input.gender);

  if (!name || name.length > 60) {
    throw new Error("invalid_profile_name");
  }
  if (!gender) {
    throw new Error("invalid_profile_gender");
  }

  const kv = await getKv();
  const key = profileKey(normalizedEmail);
  const existing = await kv.get<UserProfile>(key);
  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    email: normalizedEmail,
    name,
    gender,
    createdAt: existing.value?.createdAt ?? now,
    updatedAt: now,
  };

  await kv.set(key, nextProfile);
  return nextProfile;
}

export async function getUserProgress(
  email: string,
  slug: string,
): Promise<UserProgress | null> {
  const kv = await getKv();
  const metaEntry = await kv.get<UserProgressMeta>(metaKey(email, slug));
  const meta = metaEntry.value;
  if (!meta || meta.version !== PROGRESS_STORAGE_VERSION) return null;

  try {
    const chunkEntries = await readAllChunkEntries(kv, email, slug);
    let transcript = "";

    for (const entry of chunkEntries) {
      if (!entry.value) continue;
      const text = await decompressTextGzip(entry.value.data);
      transcript += text;
    }

    return {
      transcript,
      updatedAt: meta.updatedAt,
      gameSnapshot: meta.gameSnapshot,
    };
  } catch (error) {
    console.error(
      `user_progress read failed for ${email}/${slug}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

export async function saveUserProgress(
  email: string,
  slug: string,
  progress: UserProgress,
): Promise<void> {
  const kv = await getKv();
  let attempt = 0;

  while (attempt < SAVE_RETRY_LIMIT) {
    attempt++;
    const metaEntry = await kv.get<UserProgressMeta>(metaKey(email, slug));

    try {
      if (!metaEntry.value) {
        await writeFullProgress(kv, email, slug, progress, null);
      } else {
        await appendProgressDelta(kv, email, slug, progress, metaEntry);
      }
      return;
    } catch (error) {
      if (
        error instanceof Error && error.message === "user_progress_conflict" &&
        attempt < SAVE_RETRY_LIMIT
      ) {
        continue;
      }
      throw error;
    }
  }
}

export async function getUserProgressMap(
  email: string,
  slugs: string[],
): Promise<Map<string, UserProgress>> {
  const map = new Map<string, UserProgress>();
  const results = await Promise.all(
    slugs.map((slug) => getUserProgress(email, slug)),
  );
  results.forEach((progress, index) => {
    if (progress) {
      map.set(slugs[index], progress);
    }
  });

  return map;
}

export async function clearUserProgressForGame(
  email: string,
  slug: string,
): Promise<void> {
  const kv = await getKv();

  const chunkEntries = await readAllChunkEntries(kv, email, slug);
  let op = kv.atomic()
    .delete(metaKey(email, slug))
    // Legacy cleanup for hard-cut transition.
    .delete(["user_progress", email, slug]);

  for (const entry of chunkEntries) {
    op = op.delete(entry.key);
  }

  await op.commit();
}
