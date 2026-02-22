export type CharacterVisibility = "hidden" | "locked" | "available";

export interface MilestonePromptOverride {
  milestoneId: string;
  promptAddition: string;
}

export interface Character {
  id: string;
  name: string;
  bio: string;
  systemPrompt: string;
  initialVisibility: CharacterVisibility;
  milestonePrompts?: MilestonePromptOverride[];
}

export interface AssistantConfig {
  id: string;
  name: string;
  bio: string;
  systemPrompt: string;
}

export interface PlotMilestone {
  id: string;
  title: string;
  description: string;
  prerequisiteIds: string[];
  unlocksCharacterIds: string[];
}

export interface PrizeCondition {
  requiredMilestoneIds: string[];
  targetCharacterId: string;
  secretKey: string;
  revelationPrompt: string;
}

export interface ProgressState {
  turn: number;
  discoveredMilestoneIds: string[];
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
  isAdult: boolean;
  assistant: AssistantConfig;
  plotMilestones: PlotMilestone[];
  characters: Character[];
  prizeConditions: PrizeCondition[];
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
  assistantId: string;
  plotMilestones: PlotMilestone[];
  characters: Character[];
  encounteredCharacterIds: string[];
  progressState: ProgressState;
}

export interface UserProgress {
  transcript: string;
  updatedAt: string;
  gameSnapshot?: UserGameSnapshot;
}
