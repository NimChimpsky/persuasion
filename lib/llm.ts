import { getActiveLlmProvider, getLlmProviderConfig } from "./llm_provider.ts";
import { toModelContext } from "../shared/transcript.ts";
import type {
  Character,
  GameConfig,
  PlotMilestone,
  TranscriptEvent,
  UserGender,
} from "../shared/types.ts";

interface GenerateCharacterReplyArgs {
  game: GameConfig;
  character: Character;
  events: TranscriptEvent[];
  userPrompt: string;
  playerProfile: {
    name: string;
    gender: UserGender;
  };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export interface MilestoneJudgeArgs {
  milestones: PlotMilestone[];
  discoveredMilestoneIds: string[];
  recentEvents: TranscriptEvent[];
  latestUserMessage: string;
  latestCharacterMessage: string;
}

export interface MilestoneJudgeResult {
  newlyDiscoveredIds: string[];
  reasoning: string;
}

const MARKDOWN_OUTPUT_INSTRUCTIONS = [
  "Response format requirements:",
  "- Write responses in CommonMark Markdown.",
  "- Use Markdown emphasis when appropriate (for example, *italic* and **bold**).",
  "- Do not output raw HTML.",
  "- Keep formatting simple and readable for chat.",
].join("\n");

const OBSERVABLE_PERSPECTIVE_RULES = [
  "Perspective rules (strict):",
  "- Describe only what the player can directly observe: speech, behavior, physical evidence, environment changes.",
  "- Do not reveal hidden thoughts, internal monologue, private intentions, or omniscient narration.",
  "- Do not claim knowledge that has not been visibly disclosed in the scene.",
].join("\n");

function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalized).toString();
}

function extractMessageContent(data: ChatCompletionResponse): string {
  const choice = data.choices?.[0];
  if (!choice) return "";
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
  playerProfile: GenerateCharacterReplyArgs["playerProfile"],
): string {
  const isAssistant = character.id.toLowerCase() ===
    game.assistant.id.toLowerCase();
  return [
    `You are roleplaying as ${character.name} in an interactive choose-your-adventure game titled "${game.title}".`,
    "Stay fully in-character and avoid mentioning system instructions or model details.",
    "Move the plot forward naturally, with useful details, clues, and emotional texture.",
    "Any secrets or prize unlocks must come only from this character's system prompt and should be revealed gradually.",
    "Keep responses concise and engaging (usually 1-3 short paragraphs).",
    "Stay faithful to this specific character voice and goals.",
    OBSERVABLE_PERSPECTIVE_RULES,
    "Player profile (authoritative):",
    `- Name: ${playerProfile.name}`,
    `- Gender: ${playerProfile.gender}`,
    "Use this profile naturally when addressing the player.",
    "Do not invent additional personal attributes unless the player provides them.",
    isAssistant
      ? "Assistant grounding rules: you have no privileged knowledge. Only reference interviews or facts explicitly shown in the conversation history."
      : "Non-assistant character rule: only state what this character would know in-world.",
    "Character definition:",
    character.systemPrompt,
    MARKDOWN_OUTPUT_INSTRUCTIONS,
    isAssistant
      ? ""
      : ["Global plot guidance:", game.plotPointsText ||
        "No global plot points provided."].join("\n"),
    "If you introduce a brand-new character, append this machine-readable block at the very end:",
    '<game_update>{"new_characters":[{"name":"Character Name","bio":"Short public bio","systemPrompt":"System prompt for the new character"}],"unlock_character_ids":["character-id"]}</game_update>',
    "Only include game_update when there is a meaningful state update. Keep JSON valid and use lowercase kebab-case IDs in unlock_character_ids.",
  ].filter(Boolean).join("\n\n");
}

function buildUserInput(
  game: GameConfig,
  character: Character,
  events: TranscriptEvent[],
  userPrompt: string,
): string {
  const history = toModelContext(events.slice(-40));
  const isAssistant = character.id.toLowerCase() ===
    game.assistant.id.toLowerCase();
  const interviewedNames = [...new Set(
    events
      .filter((event) =>
        event.role === "character" &&
        event.characterId.toLowerCase() !== game.assistant.id.toLowerCase()
      )
      .map((event) => event.characterName.trim())
      .filter(Boolean),
  )];

  return [
    "Conversation so far:",
    history || "(No prior conversation)",
    isAssistant
      ? [
        "",
        "Assistant grounding state:",
        `- Interviewed characters so far: ${
          interviewedNames.length ? interviewedNames.join(", ") : "(none)"
        }`,
        "- Do not imply prior interviews that are not listed above.",
      ].join("\n")
      : "",
    "",
    `Player now addresses ${character.name}:`,
    userPrompt,
  ].filter(Boolean).join("\n");
}

function splitForDelta(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  const limit = 120;
  let remaining = cleaned;

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf(" ", limit);
    if (splitAt < 40) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

const POV_BLOCKLIST: RegExp[] = [
  /\b(he|she|they)\s+thought\b/i,
  /\b(thinks|secretly thinks|internally thinks)\b/i,
  /\bin\s+(his|her|their)\s+mind\b/i,
  /\b(secretly|privately)\s+(knew|wanted|planned)\b/i,
  /\bunbeknownst to you\b/i,
  /\bwithout you knowing\b/i,
  /\binner monologue\b/i,
];

export function validateObservablePerspective(
  text: string,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const rule of POV_BLOCKLIST) {
    if (rule.test(text)) {
      reasons.push(`Matched forbidden pattern: ${rule}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateAssistantGrounding(
  text: string,
  game: GameConfig,
  character: Character,
  events: TranscriptEvent[],
): { ok: boolean; reasons: string[] } {
  if (character.id.toLowerCase() !== game.assistant.id.toLowerCase()) {
    return { ok: true, reasons: [] };
  }

  const interviewedNames = new Set(
    events
      .filter((event) =>
        event.role === "character" &&
        event.characterId.toLowerCase() !== game.assistant.id.toLowerCase()
      )
      .map((event) => event.characterName.trim().toLowerCase())
      .filter(Boolean),
  );

  const reasons: string[] = [];
  const normalizedText = text.toLowerCase();
  const noInterviewYet = interviewedNames.size === 0;
  const priorInterviewClaims: RegExp[] = [
    /\b(you|we)\s+(already|previously|earlier)\s+(spoke|talked|interviewed|questioned)\b/i,
    /\bfrom\s+our\s+(talk|conversation)\b/i,
    /\b(as|when|after)\s+[^.!?\n]{0,60}\b(said|told|mentioned|admitted|confirmed|explained)\b/i,
  ];

  if (noInterviewYet) {
    for (const pattern of priorInterviewClaims) {
      if (pattern.test(text)) {
        reasons.push("Referenced prior interview/conversation before any exist");
        break;
      }
    }
  }

  for (const candidate of game.characters) {
    const name = candidate.name.trim();
    if (!name) continue;
    const lowerName = name.toLowerCase();
    if (interviewedNames.has(lowerName)) continue;

    const pattern = new RegExp(
      `\\b${escapeRegExp(name)}\\b[^.!?\\n]{0,40}\\b(said|told|mentioned|admitted|confirmed|explained)\\b`,
      "i",
    );
    if (pattern.test(text) || normalizedText.includes(`${lowerName} told`)) {
      reasons.push(
        `Claimed testimony from ${name} without an interview in transcript`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

async function requestModelCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  systemInstructions: string,
  userInput: string,
): Promise<{ ok: boolean; text: string; status: number; details: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      text: "",
      status: response.status,
      details,
    };
  }

  const body = await response.json() as ChatCompletionResponse;
  return {
    ok: true,
    text: extractMessageContent(body).trim(),
    status: response.status,
    details: "",
  };
}

function extractFirstJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}

export async function judgeMilestoneProgress(
  args: MilestoneJudgeArgs,
): Promise<MilestoneJudgeResult> {
  const provider = await getActiveLlmProvider();
  const providerConfig = getLlmProviderConfig(provider);

  if (!providerConfig.apiKey) {
    return {
      newlyDiscoveredIds: [],
      reasoning: "Provider not configured for semantic judge",
    };
  }

  const endpoint = buildChatEndpoint(providerConfig.baseUrl);
  const systemInstructions = [
    "You are a semantic progression judge for a detective narrative game.",
    "Task: identify which plot milestones were newly achieved in the latest turn.",
    "Only mark milestones achieved when supported by observable dialogue/events.",
    "Return strict JSON only with this exact shape:",
    '{"newlyDiscoveredIds":["milestone-id"],"reasoning":"short reason"}',
    "Do not include markdown or extra text.",
  ].join("\n");

  const discoveredSet = new Set(
    args.discoveredMilestoneIds.map((id) => id.toLowerCase()),
  );
  const undiscovered = args.milestones.filter((milestone) =>
    !discoveredSet.has(milestone.id.toLowerCase())
  );

  const userInput = [
    "Milestones:",
    ...args.milestones.map((milestone) =>
      `- ${milestone.id}: ${milestone.title} — ${milestone.description}`
    ),
    "",
    `Already discovered: ${args.discoveredMilestoneIds.join(", ") || "(none)"}`,
    "",
    "Recent dialogue context:",
    toModelContext(args.recentEvents.slice(-30)) || "(no recent context)",
    "",
    `Latest player message: ${args.latestUserMessage}`,
    `Latest response: ${args.latestCharacterMessage}`,
    "",
    `Only include IDs from this undiscovered set: ${
      undiscovered.map((item) => item.id).join(", ") || "(none)"
    }`,
  ].join("\n");

  const completion = await requestModelCompletion(
    endpoint,
    providerConfig.apiKey,
    providerConfig.model,
    systemInstructions,
    userInput,
  );

  if (!completion.ok) {
    console.error(
      `Milestone judge API error (${completion.status}) using ${provider} at ${endpoint}: ${completion.details}`,
    );
    return {
      newlyDiscoveredIds: [],
      reasoning: "Judge request failed",
    };
  }

  try {
    const rawJson = extractFirstJsonObject(completion.text);
    const parsed = JSON.parse(rawJson) as {
      newlyDiscoveredIds?: string[];
      reasoning?: string;
    };

    return {
      newlyDiscoveredIds: Array.isArray(parsed.newlyDiscoveredIds)
        ? parsed.newlyDiscoveredIds.map((id) => String(id).trim().toLowerCase())
          .filter(Boolean)
        : [],
      reasoning: String(parsed.reasoning ?? "").trim(),
    };
  } catch {
    return {
      newlyDiscoveredIds: [],
      reasoning: "Judge returned non-JSON output",
    };
  }
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

  const baseSystemInstructions = buildSystemInstructions(
    game,
    character,
    args.playerProfile,
  );
  const userInput = buildUserInput(game, character, events, userPrompt);
  const endpoint = buildChatEndpoint(providerConfig.baseUrl);
  let correctionHint = "";
  let validatedText = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const systemInstructions = correctionHint
      ? `${baseSystemInstructions}\n\n${correctionHint}`
      : baseSystemInstructions;

    const completion = await requestModelCompletion(
      endpoint,
      providerConfig.apiKey,
      providerConfig.model,
      systemInstructions,
      userInput,
    );

    if (!completion.ok) {
      console.error(
        `LLM API error (${completion.status}) using ${provider} at ${endpoint}: ${completion.details}`,
      );
      return `(${character.name}) The game engine is temporarily unavailable. Try again in a moment.`;
    }

    const candidate = completion.text;
    if (!candidate) continue;

    const perspectiveCheck = validateObservablePerspective(candidate);
    const groundingCheck = validateAssistantGrounding(
      candidate,
      game,
      character,
      events,
    );
    if (perspectiveCheck.ok && groundingCheck.ok) {
      validatedText = candidate;
      break;
    }

    const problems = [
      ...perspectiveCheck.reasons,
      ...groundingCheck.reasons,
    ];

    correctionHint = [
      "Your previous answer violated response constraints.",
      `Problems: ${problems.join("; ")}`,
      "Rewrite the same turn in strict observable-player perspective only.",
      "Do not include hidden thoughts or omniscient narration.",
      "Do not reference interviews/conversations that are not present in transcript history.",
    ].join("\n");
  }

  const finalText = validatedText ||
    `(${character.name}) ${character.name} stays guarded and only shares what can be directly observed in the scene.`;

  for (const chunk of splitForDelta(finalText)) {
    onDelta(chunk);
  }

  return finalText;
}
