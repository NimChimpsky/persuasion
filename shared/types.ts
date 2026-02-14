export interface Character {
  id: string;
  name: string;
  bio: string;
  systemPrompt: string;
}

export interface GameConfig {
  slug: string;
  title: string;
  introText: string;
  plotPointsText: string;
  narratorPrompt?: string;
  characters: Character[];
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameIndexEntry {
  slug: string;
  title: string;
  active: boolean;
  characterCount: number;
  updatedAt: string;
}

export type TranscriptRole = "user" | "character";

export interface TranscriptEvent {
  role: TranscriptRole;
  characterId: string;
  characterName: string;
  text: string;
  at: string;
}

export interface UserGameSnapshot {
  title: string;
  introText: string;
  plotPointsText: string;
  narratorPrompt?: string;
  characters: Character[];
  encounteredCharacterIds: string[];
}

export interface UserProgress {
  transcript: string;
  updatedAt: string;
  gameSnapshot?: UserGameSnapshot;
}
