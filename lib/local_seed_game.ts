import { ensureUniqueIds, slugify } from "./slug.ts";
import type {
  AssistantConfig,
  Character,
  CharacterVisibility,
  GameConfig,
  GameIndexEntry,
  MilestonePromptOverride,
  PlotMilestone,
  PrizeCondition,
} from "../shared/types.ts";

const DEFAULT_ASSISTANT_SYSTEM_PROMPT =
  "You are the player's investigation assistant. Stay supportive, practical, and grounded in observable evidence. Ask useful follow-up questions, suggest sensible next steps, and avoid spoilers.";

interface ParsedOutline {
  title: string;
  introText: string;
  plotPointsText: string;
  assistant: AssistantConfig;
  plotMilestones: PlotMilestone[];
  characters: Character[];
  prizeConditions: PrizeCondition[];
}

type SectionKey =
  | "title"
  | "intro"
  | "plot"
  | "prize"
  | "characters"
  | "user"
  | "assistant"
  | "milestones";

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
  if (normalized.startsWith("plot milestone")) return "milestones";
  if (normalized.startsWith("plot")) return "plot";
  if (normalized.startsWith("prize")) return "prize";
  if (normalized.startsWith("secret")) return "prize";
  if (normalized.startsWith("character")) return "characters";
  if (normalized === "user") return "user";
  if (normalized === "assistant") return "assistant";

  return null;
}

function deriveBioFromPrompt(prompt: string): string {
  const firstSentence = prompt.split(/[.!?]/)[0]?.trim() ?? "";
  const source = firstSentence || prompt.trim();
  const maxLen = 140;
  return source.length <= maxLen ? source : `${source.slice(0, maxLen - 3)}...`;
}

function parseAssistant(lines: string[]): AssistantConfig {
  const map = new Map<string, string>();

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;
    map.set(key, value);
  }

  const name = map.get("name") ?? "Assistant";
  const bio = map.get("bio") ??
    "Your investigation assistant who helps track clues and suggest next steps.";
  if (!name.trim() || !bio.trim()) {
    throw new Error("Assistant section is incomplete or invalid");
  }

  return {
    id: slugify(name),
    name: name.trim(),
    bio: bio.trim(),
    systemPrompt: DEFAULT_ASSISTANT_SYSTEM_PROMPT,
  };
}

function parseMilestones(lines: string[]): PlotMilestone[] {
  const parsed = lines.flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];

    const segments = trimmed.split("|").map((s) => s.trim());
    if (segments.length < 2) {
      return [{ title: trimmed, description: trimmed, prerequisiteIds: [] as string[], unlocksCharacterIds: [] as string[] }];
    }

    const title = segments[0];
    const description = segments[1];
    if (!title || !description) return [];

    let prerequisiteIds: string[] = [];
    let unlocksCharacterIds: string[] = [];

    for (let i = 2; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startsWith("requires:")) {
        const val = seg.slice("requires:".length).trim();
        prerequisiteIds = val.split(",").map((id) => slugify(id.trim())).filter(Boolean);
      } else if (seg.startsWith("unlocks:")) {
        const val = seg.slice("unlocks:".length).trim();
        unlocksCharacterIds = val.split(",").map((id) => slugify(id.trim())).filter(Boolean);
      }
    }

    return [{ title, description, prerequisiteIds, unlocksCharacterIds }];
  });

  const ids = ensureUniqueIds(parsed.map((item) => slugify(item.title)));
  return parsed.map((item, index) => ({
    id: ids[index],
    title: item.title,
    description: item.description,
    prerequisiteIds: item.prerequisiteIds,
    unlocksCharacterIds: item.unlocksCharacterIds,
  }));
}

function parsePrizeConditions(lines: string[]): PrizeCondition[] {
  return lines.flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];

    // New format: requires: milestone-id | character: char-id | key: secretkey | revelation prompt text
    const segments = trimmed.split("|").map((s) => s.trim());

    let requiredMilestoneIds: string[] = [];
    let targetCharacterId = "";
    let secretKey = "";
    let revelationPrompt = "";

    for (const seg of segments) {
      if (seg.startsWith("requires:")) {
        const val = seg.slice("requires:".length).trim();
        requiredMilestoneIds = val.split(",").map((id) => slugify(id.trim())).filter(Boolean);
      } else if (seg.startsWith("character:")) {
        targetCharacterId = slugify(seg.slice("character:".length).trim());
      } else if (seg.startsWith("key:")) {
        secretKey = seg.slice("key:".length).trim();
      } else if (requiredMilestoneIds.length > 0 && targetCharacterId && secretKey) {
        // Remaining segment after all key fields is the revelation prompt
        revelationPrompt = seg;
      }
    }

    if (!requiredMilestoneIds.length || !targetCharacterId || !secretKey || !revelationPrompt) {
      return [];
    }

    return [{ requiredMilestoneIds, targetCharacterId, secretKey, revelationPrompt }];
  });
}

interface CharacterBlock {
  name: string;
  systemPrompt: string;
  visibility: CharacterVisibility;
  milestonePrompts: MilestonePromptOverride[];
}

function parseCharacterBlocks(rawLines: string[]): Character[] {
  // Rejoin all lines to handle multi-line character definitions.
  // Block starts with "Name, prompt text..." and continues with @-prefixed directive lines
  // or continuation lines until the next "- " character line.
  const blocks: CharacterBlock[] = [];
  let currentBlock: CharacterBlock | null = null;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for @-prefixed directives (belong to current block)
    if (line.startsWith("@") && currentBlock) {
      if (line.startsWith("@visibility:")) {
        const val = line.slice("@visibility:".length).trim().toLowerCase();
        if (val === "hidden" || val === "locked" || val === "available") {
          currentBlock.visibility = val;
        }
      } else if (line.startsWith("@when ")) {
        const rest = line.slice("@when ".length);
        const colonIdx = rest.indexOf(":");
        if (colonIdx > 0) {
          const milestoneId = slugify(rest.slice(0, colonIdx).trim());
          const promptAddition = rest.slice(colonIdx + 1).trim();
          if (milestoneId && promptAddition) {
            currentBlock.milestonePrompts.push({ milestoneId, promptAddition });
          }
        }
      }
      continue;
    }

    // New character block: "Name, system prompt text..."
    const commaIndex = line.indexOf(",");
    if (commaIndex <= 0) continue;

    const name = line.slice(0, commaIndex).trim();
    const systemPrompt = line.slice(commaIndex + 1).trim();
    if (!name || !systemPrompt) continue;

    // Save previous block
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    currentBlock = {
      name,
      systemPrompt,
      visibility: "available",
      milestonePrompts: [],
    };
  }

  // Push final block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  const ids = ensureUniqueIds(blocks.map((b) => slugify(b.name)));
  return blocks.map((block, index) => ({
    id: ids[index],
    name: block.name,
    bio: deriveBioFromPrompt(block.systemPrompt),
    systemPrompt: block.systemPrompt,
    initialVisibility: block.visibility,
    milestonePrompts: block.milestonePrompts.length > 0 ? block.milestonePrompts : undefined,
  }));
}

function parseGameOutline(input: string): ParsedOutline {
  const sections: Record<SectionKey, string[]> = {
    title: [],
    intro: [],
    plot: [],
    prize: [],
    characters: [],
    user: [],
    assistant: [],
    milestones: [],
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

    // Character section supports multi-line blocks with @-prefixed directives
    if (currentSection === "characters") {
      if (line.startsWith("-")) {
        const value = line.slice(1).trim();
        if (value) sections.characters.push(value);
      } else if (line.startsWith("@")) {
        // Directive line for the current character block
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
  const assistant = parseAssistant(sections.assistant);
  const plotMilestones = parseMilestones(sections.milestones);
  const prizeConditions = parsePrizeConditions(sections.prize);

  const plotLines = [
    ...sections.plot,
    ...sections.user.map((line) => `Player character: ${line}`),
  ];

  if (
    !title || !introText || characters.length === 0 ||
    plotMilestones.length === 0
  ) {
    throw new Error(`Game outline is incomplete or invalid: "${title || "(no title)"}"`);
  }

  return {
    title,
    introText,
    plotPointsText: plotLines.join("\n"),
    assistant,
    plotMilestones,
    characters,
    prizeConditions,
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
    assistant: parsed.assistant,
    plotMilestones: parsed.plotMilestones,
    characters: parsed.characters,
    prizeConditions: parsed.prizeConditions,
    active: true,
    createdBy: "startup-reset@persuasion.system",
    createdAt: now,
    updatedAt: now,
  };
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
    plotPointsText: parsed.plotPointsText,
    assistant: parsed.assistant,
    plotMilestones: parsed.plotMilestones,
    characters: parsed.characters,
    prizeConditions: parsed.prizeConditions,
    active: true,
    createdBy: "startup-reset@persuasion.system",
    createdAt: now,
    updatedAt: now,
  };
}

export async function buildChiantiGameConfig(
  now = new Date().toISOString(),
): Promise<GameConfig> {
  return buildGameConfigFromFile(CHIANTI_OUTLINE_URL, now);
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
