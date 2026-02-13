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

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalized).toString();
}

function extractReply(data: ChatCompletionResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return "";
}

export async function generateCharacterReply(
  args: GenerateCharacterReplyArgs,
): Promise<string> {
  const { game, character, events, userPrompt } = args;
  const provider = await getActiveLlmProvider();
  const providerConfig = getLlmProviderConfig(provider);

  if (!providerConfig.apiKey) {
    return `(${character.name}) The game engine is unavailable because ${providerConfig.label} is not configured.`;
  }

  const history = toModelContext(events.slice(-40));
  const isNarrator = character.id === NARRATOR_ID;
  const systemInstructions = [
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
    "Global plot guidance:",
    game.plotPointsText || "No global plot points provided.",
  ].join("\n\n");

  const userInput = [
    "Conversation so far:",
    history || "(No prior conversation)",
    "",
    `Player now addresses ${character.name}:`,
    userPrompt,
  ].join("\n");

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
      `LLM API error (${response.status}) using ${provider} at ${endpoint}: ${details}`,
    );
    return `(${character.name}) The game engine is temporarily unavailable. Try again in a moment.`;
  }

  const data = await response.json() as ChatCompletionResponse;
  const text = extractReply(data);

  return text ||
    `(${character.name}) I need a moment to gather my thoughts. Ask me again.`;
}
