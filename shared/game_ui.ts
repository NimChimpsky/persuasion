import type { Character, SidePane, TranscriptEvent } from "./types.ts";

const MAX_SIDE_PANES = 8;

export function parsePlotLines(plotPointsText: string): string[] {
  return plotPointsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildSidePanes(
  characters: Character[],
  plotPointsText: string,
  events: TranscriptEvent[],
): SidePane[] {
  const panes: SidePane[] = [];

  for (const character of characters.slice(0, MAX_SIDE_PANES)) {
    const characterEvents = events.filter((event) =>
      event.role === "character" && event.characterId === character.id
    );
    const last = characterEvents.at(-1);

    const body = characterEvents.length === 0
      ? `No conversation with ${character.name} yet. Ask the narrator for guidance or mention @${character.id}.`
      : `Spoken ${characterEvents.length} time(s). Latest reveal: ${
        trimForPanel(last?.text ?? "")
      }`;

    panes.push({
      title: character.name,
      body,
      kind: "character",
    });
  }

  const remainingSlots = MAX_SIDE_PANES - panes.length;
  const plotLines = parsePlotLines(plotPointsText);

  for (let i = 0; i < remainingSlots; i++) {
    const plotLine = plotLines[i];
    panes.push({
      title: `Plot Thread ${i + 1}`,
      body: plotLine
        ? `Tracked arc: ${plotLine}`
        : "Placeholder: this panel will be replaced by emerging plot clues and secret progress.",
      kind: "plot",
    });
  }

  return panes;
}

function trimForPanel(input: string): string {
  const clean = input.replace(/\s+/g, " ").trim();
  if (clean.length <= 120) return clean;
  return `${clean.slice(0, 117)}...`;
}

export function normalizeMentionToken(input: string): string | null {
  const mentionMatch = input.match(/@([a-z0-9_-]+)/i);
  return mentionMatch ? mentionMatch[1].toLowerCase() : null;
}
