import type { GameIndexEntry } from "./types.ts";

export interface GameSummary {
  slug: string;
  title: string;
  characterCount: number;
  updatedAt: string;
}

export function deriveBioFromDefinition(definition: string): string {
  const firstSentence = definition.split(/[.!?]/)[0]?.trim() ?? "";
  const source = firstSentence || definition.trim();
  const maxLen = 140;
  return source.length <= maxLen ? source : `${source.slice(0, maxLen - 3)}...`;
}

export function toGameSummary(game: GameIndexEntry): GameSummary {
  return {
    slug: game.slug,
    title: game.title,
    characterCount: game.characterCount,
    updatedAt: game.updatedAt,
  };
}
