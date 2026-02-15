import { ensureUniqueIds, slugify } from "./slug.ts";
import type { Character, GameConfig, GameIndexEntry } from "../shared/types.ts";

interface ParsedOutline {
  title: string;
  introText: string;
  plotPointsText: string;
  characters: Character[];
}

type SectionKey = "title" | "intro" | "plot" | "secret" | "characters" | "user";

export const OLIVE_FARM_OUTLINE_URL = new URL(
  "../murder-at-the-olive-farm.txt",
  import.meta.url,
);

function mapHeadingToSection(heading: string): SectionKey | null {
  const normalized = heading
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("game title")) return "title";
  if (normalized === "intro") return "intro";
  if (normalized.startsWith("plot")) return "plot";
  if (normalized.startsWith("secret")) return "secret";
  if (normalized.startsWith("character")) return "characters";
  if (normalized === "user") return "user";

  return null;
}

function deriveBioFromPrompt(prompt: string): string {
  const firstSentence = prompt.split(/[.!?]/)[0]?.trim() ?? "";
  const source = firstSentence || prompt.trim();
  const maxLen = 140;
  return source.length <= maxLen ? source : `${source.slice(0, maxLen - 3)}...`;
}

function parseCharacters(lines: string[]): Character[] {
  const parsed = lines.flatMap((line) => {
    const commaIndex = line.indexOf(",");
    if (commaIndex <= 0) return [];
    const name = line.slice(0, commaIndex).trim();
    const systemPrompt = line.slice(commaIndex + 1).trim();
    if (!name || !systemPrompt) return [];
    return [{ name, systemPrompt }];
  });

  const ids = ensureUniqueIds(parsed.map((item) => slugify(item.name)));
  return parsed.map((item, index) => ({
    id: ids[index],
    name: item.name,
    bio: deriveBioFromPrompt(item.systemPrompt),
    systemPrompt: item.systemPrompt,
  }));
}

function parseGameOutline(input: string): ParsedOutline {
  const sections: Record<SectionKey, string[]> = {
    title: [],
    intro: [],
    plot: [],
    secret: [],
    characters: [],
    user: [],
  };

  let currentSection: SectionKey | null = null;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      const headingText = line.replace(/^#+\s*/, "").replace(/\s*:\s*$/, "");
      currentSection = mapHeadingToSection(headingText);
      continue;
    }

    if (!line.startsWith("-")) continue;
    if (!currentSection) continue;

    const value = line.slice(1).trim();
    if (!value) continue;
    sections[currentSection].push(value);
  }

  const title = sections.title[0] ?? "";
  const introText = sections.intro.join("\n");
  const characters = parseCharacters(sections.characters);

  const plotLines = [
    ...sections.plot,
    ...sections.secret.map((line) => `Prize secret: ${line}`),
    ...sections.user.map((line) => `Player character: ${line}`),
  ];

  if (!title || !introText || characters.length === 0) {
    throw new Error("Olive Farm outline is incomplete or invalid");
  }

  return {
    title,
    introText,
    plotPointsText: plotLines.join("\n"),
    characters,
  };
}

export async function buildOliveFarmGameConfig(
  now = new Date().toISOString(),
): Promise<GameConfig> {
  const outlineText = await Deno.readTextFile(OLIVE_FARM_OUTLINE_URL);
  const parsed = parseGameOutline(outlineText);
  const slug = slugify(parsed.title);

  return {
    slug,
    title: parsed.title,
    introText: parsed.introText,
    plotPointsText: parsed.plotPointsText,
    characters: parsed.characters,
    active: true,
    createdBy: "startup-reset@persuasion.system",
    createdAt: now,
    updatedAt: now,
  };
}

export async function upsertGameAndIndex(
  kv: Deno.Kv,
  game: GameConfig,
): Promise<void> {
  const existing = await kv.get<GameConfig>(["games_by_slug", game.slug]);
  const createdAt = existing.value?.createdAt ?? game.createdAt;
  const createdBy = existing.value?.createdBy ?? game.createdBy;

  const persistedGame: GameConfig = {
    ...game,
    createdAt,
    createdBy,
  };

  const index: GameIndexEntry = {
    slug: persistedGame.slug,
    title: persistedGame.title,
    active: persistedGame.active,
    characterCount: persistedGame.characters.length,
    updatedAt: persistedGame.updatedAt,
  };

  await kv.atomic()
    .set(["games_by_slug", persistedGame.slug], persistedGame)
    .set(["games_index", persistedGame.slug], index)
    .commit();
}
