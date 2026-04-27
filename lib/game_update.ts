import { slugify } from "./slug.ts";

export interface NewCharacterInput {
  name: string;
  bio: string;
  definition: string;
}

export interface GameUpdateDirective {
  cleanText: string;
  newCharacters: NewCharacterInput[];
  unlockCharacterIds: string[];
}

export function parseGameUpdateDirective(
  replyText: string,
): GameUpdateDirective {
  const match = replyText.match(
    /<game_update>\s*([\s\S]*?)\s*<\/game_update>/i,
  );

  if (!match) {
    return {
      cleanText: replyText.trim(),
      newCharacters: [],
      unlockCharacterIds: [],
    };
  }

  const before = replyText.slice(0, match.index).trimEnd();
  const after = replyText.slice((match.index ?? 0) + match[0].length)
    .trimStart();
  const cleanText = `${before}${before && after ? "\n\n" : ""}${after}`.trim();

  try {
    const parsed = JSON.parse(match[1]) as {
      new_characters?: Array<{
        name?: string;
        bio?: string;
        definition?: string;
        systemPrompt?: string;
      }>;
      unlock_character_ids?: string[];
    };

    const newCharacters = (parsed.new_characters ?? [])
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        bio: String(item.bio ?? "").trim(),
        definition: String(item.definition ?? item.systemPrompt ?? "").trim(),
      }))
      .filter((item) => item.name && item.bio && item.definition)
      .slice(0, 3);

    const unlockCharacterIds = (parsed.unlock_character_ids ?? [])
      .map((id) => slugify(String(id ?? "").trim()))
      .filter(Boolean);

    return { cleanText, newCharacters, unlockCharacterIds };
  } catch {
    return { cleanText, newCharacters: [], unlockCharacterIds: [] };
  }
}
