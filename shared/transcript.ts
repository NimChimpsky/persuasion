import type { TranscriptEvent } from "./types.ts";

export function parseTranscript(transcript: string): TranscriptEvent[] {
  if (!transcript.trim()) return [];

  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as TranscriptEvent;
        if (!parsed.role || !parsed.characterId || !parsed.characterName) {
          return [];
        }
        return [parsed];
      } catch {
        return [];
      }
    });
}

export function appendEvents(
  transcript: string,
  events: TranscriptEvent[],
): string {
  const payload = events.map((event) => JSON.stringify(event)).join("\n");
  if (!payload) return transcript;
  if (!transcript.trim()) return `${payload}\n`;
  return `${transcript.trimEnd()}\n${payload}\n`;
}

export function toModelContext(events: TranscriptEvent[]): string {
  return events.map((event) => {
    if (event.role === "user") {
      return `[${event.at}] PLAYER -> ${event.characterName}: ${event.text}`;
    }
    return `[${event.at}] ${event.characterName}: ${event.text}`;
  }).join("\n");
}
