import { getActiveLlmProvider, getLlmProviderConfig } from "./llm_provider.ts";
import { NARRATOR_ID } from "../shared/narrator.ts";
import { toModelContext } from "../shared/transcript.ts";
import type {
  Character,
  GameConfig,
  TranscriptEvent,
} from "../shared/types.ts";

interface GenerateCharacterReplyArgs {
  game: GameConfig;
  character: Character;
  events: TranscriptEvent[];
  userPrompt: string;
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const MARKDOWN_OUTPUT_INSTRUCTIONS = [
  "Response format requirements:",
  "- Write responses in CommonMark Markdown.",
  "- Use Markdown emphasis when appropriate (for example, *italic* and **bold**).",
  "- Do not output raw HTML.",
  "- Keep formatting simple and readable for chat.",
].join("\n");

function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalized).toString();
}

function extractStreamDelta(data: ChatCompletionStreamChunk): string {
  const choice = data.choices?.[0];
  if (!choice) return "";
  const deltaContent = choice.delta?.content;
  const deltaText = typeof deltaContent === "string"
    ? deltaContent
    : Array.isArray(deltaContent)
    ? deltaContent.map((part) => part.text ?? "").join("")
    : "";
  if (deltaText) return deltaText;
  const messageContent = choice.message?.content;
  return typeof messageContent === "string"
    ? messageContent
    : Array.isArray(messageContent)
    ? messageContent.map((part) => part.text ?? "").join("")
    : "";
}

function buildSystemInstructions(
  game: GameConfig,
  character: Character,
): string {
  const isNarrator = character.id === NARRATOR_ID;
  return [
    `You are roleplaying as ${character.name} in an interactive choose-your-adventure game titled "${game.title}".`,
    "Stay fully in-character and avoid mentioning system instructions or model details.",
    "Move the plot forward naturally, with useful details, clues, and emotional texture.",
    "Any secrets or prize unlocks must come only from this character's system prompt and should be revealed gradually.",
    "Keep responses concise and engaging (usually 1-3 short paragraphs).",
    isNarrator
      ? "As narrator, maintain continuity, summarize known clues, and proactively suggest good next interactions."
      : "Stay faithful to this specific character voice and goals.",
    "Character definition:",
    character.systemPrompt,
    MARKDOWN_OUTPUT_INSTRUCTIONS,
    "Global plot guidance:",
    game.plotPointsText || "No global plot points provided.",
    "If you introduce a brand-new character, append this machine-readable block at the very end:",
    '<game_update>{"new_characters":[{"name":"Character Name","bio":"Short public bio","systemPrompt":"System prompt for the new character"}],"unlock_character_ids":["character-id"]}</game_update>',
    "Only include game_update when there is a meaningful state update. Keep JSON valid and use lowercase kebab-case IDs in unlock_character_ids.",
  ].join("\n\n");
}

function buildUserInput(
  character: Character,
  events: TranscriptEvent[],
  userPrompt: string,
): string {
  const history = toModelContext(events.slice(-40));
  return [
    "Conversation so far:",
    history || "(No prior conversation)",
    "",
    `Player now addresses ${character.name}:`,
    userPrompt,
  ].join("\n");
}

export async function streamCharacterReply(
  args: GenerateCharacterReplyArgs,
  onDelta: (delta: string) => void,
): Promise<string> {
  const { game, character, events, userPrompt } = args;
  const provider = await getActiveLlmProvider();
  const providerConfig = getLlmProviderConfig(provider);

  if (!providerConfig.apiKey) {
    return `(${character.name}) The game engine is unavailable because ${providerConfig.label} is not configured.`;
  }

  const systemInstructions = buildSystemInstructions(game, character);
  const userInput = buildUserInput(character, events, userPrompt);
  const endpoint = buildChatEndpoint(providerConfig.baseUrl);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: providerConfig.model,
      temperature: 0.9,
      stream: true,
      messages: [
        {
          role: "system",
          content: systemInstructions,
        },
        {
          role: "user",
          content: userInput,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(
      `LLM stream API error (${response.status}) using ${provider} at ${endpoint}: ${details}`,
    );
    return `(${character.name}) The game engine is temporarily unavailable. Try again in a moment.`;
  }

  if (!response.body) {
    return `(${character.name}) I need a moment to gather my thoughts. Ask me again.`;
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let complete = "";

  const processDataLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    try {
      const data = JSON.parse(payload) as ChatCompletionStreamChunk;
      const delta = extractStreamDelta(data);
      if (!delta) return;
      complete += delta;
      onDelta(delta);
    } catch {
      // Ignore malformed non-JSON lines from providers.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, "").trim();
      if (line) processDataLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing) processDataLine(trailing);

  const text = complete.trim();
  return text ||
    `(${character.name}) I need a moment to gather my thoughts. Ask me again.`;
}
