import { getKv } from "./kv.ts";
import type {
  GameIndexEntry,
  GameStory,
  UserProgress,
} from "../shared/types.ts";

export async function getGameBySlug(slug: string): Promise<GameStory | null> {
  const kv = await getKv();
  const entry = await kv.get<GameStory>(["games_by_slug", slug]);
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

export async function createGame(story: GameStory): Promise<void> {
  const kv = await getKv();
  const index: GameIndexEntry = {
    slug: story.slug,
    title: story.title,
    active: story.active,
    characterCount: story.characters.length,
    updatedAt: story.updatedAt,
  };

  const result = await kv.atomic()
    .check({ key: ["games_by_slug", story.slug], versionstamp: null })
    .set(["games_by_slug", story.slug], story)
    .set(["games_index", story.slug], index)
    .commit();

  if (!result.ok) {
    throw new Error("game_slug_exists");
  }
}

export async function getUserProgress(
  email: string,
  slug: string,
): Promise<UserProgress | null> {
  const kv = await getKv();
  const entry = await kv.get<UserProgress>(["user_progress", email, slug]);
  return entry.value;
}

export async function saveUserProgress(
  email: string,
  slug: string,
  progress: UserProgress,
): Promise<void> {
  const kv = await getKv();
  await kv.set(["user_progress", email, slug], progress);
}

export async function getUserProgressMap(
  email: string,
  slugs: string[],
): Promise<Map<string, UserProgress>> {
  const kv = await getKv();
  const results: Deno.KvEntryMaybe<UserProgress>[] = await Promise.all(
    slugs.map((slug) => kv.get<UserProgress>(["user_progress", email, slug])),
  );

  const map = new Map<string, UserProgress>();
  results.forEach((entry: Deno.KvEntryMaybe<UserProgress>, index: number) => {
    if (entry.value) {
      map.set(slugs[index], entry.value);
    }
  });

  return map;
}
