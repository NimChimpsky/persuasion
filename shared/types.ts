export interface Character {
  id: string;
  name: string;
  bio: string;
  systemPrompt: string;
}

export type UserGender = "male" | "female" | "non-binary";

export interface UserProfile {
  email: string;
  name: string;
  gender: UserGender;
  createdAt: string;
  updatedAt: string;
}

export interface GameConfig {
  slug: string;
  title: string;
  introText: string;
  plotPointsText: string;
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
  characters: Character[];
  encounteredCharacterIds: string[];
}

export interface UserProgress {
  transcript: string;
  updatedAt: string;
  gameSnapshot?: UserGameSnapshot;
}
