import { ensureUniqueIds, slugify } from "./slug.ts";
import type {
  Character,
  GameConfig,
  GameIndexEntry,
} from "../shared/types.ts";

interface ParsedOutline {
  title: string;
  introText: string;
  isAdult: boolean;
  characters: Character[];
}

type SectionKey =
  | "title"
  | "intro"
  | "uncensored"
  | "characters"
  | "user";

export const OLIVE_FARM_OUTLINE_URL = new URL(
  "../seed-games/murder-at-the-olive-farm.v2.txt",
  import.meta.url,
);

export const CHIANTI_OUTLINE_URL = new URL(
  "../seed-games/a-nice-glass-of-chianti.txt",
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
  if (normalized === "uncensored") return "uncensored";
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

function parseCharacterBlocks(rawLines: string[]): Character[] {
  const blocks: Array<{ name: string; definition: string; secretKey?: string }> = [];
  let currentBlock: { name: string; definition: string; secretKey?: string } | null = null;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for key: line (belongs to current block)
    if (line.toLowerCase().startsWith("key:") && currentBlock) {
      currentBlock.secretKey = line.slice("key:".length).trim();
      continue;
    }

    // New character block: "Name, definition text..."
    const commaIndex = line.indexOf(",");
    if (commaIndex <= 0) continue;

    const name = line.slice(0, commaIndex).trim();
    const definition = line.slice(commaIndex + 1).trim();
    if (!name || !definition) continue;

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    currentBlock = { name, definition };
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  const ids = ensureUniqueIds(blocks.map((b) => slugify(b.name)));
  return blocks.map((block, index) => ({
    id: ids[index],
    name: block.name,
    bio: deriveBioFromPrompt(block.definition),
    definition: block.definition,
    systemPrompt: "",
    secretKey: block.secretKey,
  }));
}

function parseGameOutline(input: string): ParsedOutline {
  const sections: Record<SectionKey, string[]> = {
    title: [],
    intro: [],
    uncensored: [],
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

    if (!currentSection) continue;

    if (currentSection === "characters") {
      if (line.startsWith("-")) {
        const value = line.slice(1).trim();
        if (value) sections.characters.push(value);
      } else if (line.toLowerCase().startsWith("key:")) {
        sections.characters.push(line);
      }
      continue;
    }

    if (!line.startsWith("-")) continue;

    const value = line.slice(1).trim();
    if (!value) continue;
    sections[currentSection].push(value);
  }

  const title = sections.title[0] ?? "";
  const introText = sections.intro.join("\n");
  const characters = parseCharacterBlocks(sections.characters);
  const isAdult = sections.uncensored.some(
    (line) => line.toLowerCase() === "yes" || line.toLowerCase() === "true",
  );

  // Fold user description into character definitions as world context
  if (sections.user.length > 0) {
    const userDescription = sections.user.join(" ");
    for (const character of characters) {
      character.definition += ` The player character is: ${userDescription}`;
    }
  }

  if (!title || !introText || characters.length === 0) {
    throw new Error(`Game outline is incomplete or invalid: "${title || "(no title)"}"`);
  }

  return { title, introText, isAdult, characters };
}

export async function buildGameConfigFromFile(
  fileUrl: URL,
  now = new Date().toISOString(),
): Promise<GameConfig> {
  const outlineText = await Deno.readTextFile(fileUrl);
  const parsed = parseGameOutline(outlineText);
  const slug = slugify(parsed.title);

  return {
    slug,
    title: parsed.title,
    introText: parsed.introText,
    isAdult: parsed.isAdult,
    initialized: false,
    characters: parsed.characters,
    active: true,
    createdBy: "startup-reset@persuasion.system",
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildOliveFarmGameConfig(
  now = new Date().toISOString(),
): Promise<GameConfig> {
  return await buildGameConfigFromFile(OLIVE_FARM_OUTLINE_URL, now);
}

export async function buildChiantiGameConfig(
  now = new Date().toISOString(),
): Promise<GameConfig> {
  return await buildGameConfigFromFile(CHIANTI_OUTLINE_URL, now);
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
