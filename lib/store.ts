import { getKv } from "./kv.ts";
import type {
  GameIndexEntry,
  GameStory,
  UserProgress,
} from "../shared/types.ts";

export async function getGameBySlug(slug: string): Promise<GameStory | null> {
  const kv = await getKv("store.getGameBySlug");
  const entry = await kv.get<GameStory>(["games_by_slug", slug]);
  return entry.value;
}

export async function listGames(): Promise<GameIndexEntry[]> {
  const kv = await getKv("store.listGames");
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
  const kv = await getKv("store.createGame");
  const existing = await kv.get<GameStory>(["games_by_slug", story.slug]);
  if (existing.value) {
    throw new Error("game_slug_exists");
  }

  const index: GameIndexEntry = {
    slug: story.slug,
    title: story.title,
    active: story.active,
    characterCount: story.characters.length,
    updatedAt: story.updatedAt,
  };

  await kv.set(["games_by_slug", story.slug], story);
  await kv.set(["games_index", story.slug], index);
}

export async function getUserProgress(
  email: string,
  slug: string,
): Promise<UserProgress | null> {
  const kv = await getKv("store.getUserProgress");
  const entry = await kv.get<UserProgress>(["user_progress", email, slug]);
  return entry.value;
}

export async function saveUserProgress(
  email: string,
  slug: string,
  progress: UserProgress,
): Promise<void> {
  const kv = await getKv("store.saveUserProgress");
  await kv.set(["user_progress", email, slug], progress);
}

export async function getUserProgressMap(
  email: string,
  slugs: string[],
): Promise<Map<string, UserProgress>> {
  const kv = await getKv("store.getUserProgressMap");
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
