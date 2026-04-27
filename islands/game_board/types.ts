import type { TranscriptEvent } from "../../shared/types.ts";

export interface CharacterRef {
  id: string;
  name: string;
  bio: string;
}

export interface JsonErrorResponse {
  ok?: boolean;
  error?: string;
}

export interface StreamAckPayload {
  userEvent: TranscriptEvent;
  character: { id: string; name: string };
}

export interface StreamDeltaPayload {
  text: string;
}

export interface StreamFinalPayload {
  characterEvent: TranscriptEvent;
  characters: CharacterRef[];
  encounteredCharacterIds: string[];
}

export interface StreamErrorPayload {
  error?: string;
}
