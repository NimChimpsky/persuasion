import { getKv } from "./kv.ts";
import type {
  GameConfig,
  GameIndexEntry,
  UserProgress,
} from "../shared/types.ts";

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
  const results = await Promise.all(
    slugs.map((slug) => kv.get<UserProgress>(["user_progress", email, slug])),
  );

  const map = new Map<string, UserProgress>();
  results.forEach((entry, index) => {
    if (entry.value) {
      map.set(slugs[index], entry.value);
    }
  });

  return map;
}
