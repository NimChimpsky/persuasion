import type { Character } from "./types.ts";

export const NARRATOR_ID = "narrator";
export const NARRATOR_NAME = "Narrator";
export const DEFAULT_NARRATOR_PROMPT =
  "You are the narrator and game guide. Keep track of the full game state, remind the player of known clues, and suggest next actions. Stay immersive and never break character.";

export function createNarratorCharacter(
  narratorPrompt?: string | null,
): Character {
  return {
    id: NARRATOR_ID,
    name: NARRATOR_NAME,
    bio: "Keeps track of clues, continuity, and next best moves.",
    systemPrompt: narratorPrompt?.trim() || DEFAULT_NARRATOR_PROMPT,
  };
}
