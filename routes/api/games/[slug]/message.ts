import { streamCharacterReply } from "../../../../lib/llm.ts";
import { slugify } from "../../../../lib/slug.ts";
import { calculateCredits } from "../../../../lib/credits.ts";
import {
  deductUserCredits,
  getGameBySlug,
  getGlobalAssistantConfig,
  getUserProgress,
  saveUserProgress,
} from "../../../../lib/store.ts";
import { getActiveLlmProvider } from "../../../../lib/llm_provider.ts";
import {
  appendEvents,
  parseTranscript,
} from "../../../../shared/transcript.ts";
import type {
  Character,
  GameConfig,
  TranscriptEvent,
  UserGameSnapshot,
} from "../../../../shared/types.ts";
import { define } from "../../../../utils.ts";

interface MessageRequest {
  text: string;
  characterId: string;
}

interface NewCharacterInput {
  name: string;
  bio: string;
  definition: string;
}

interface GameUpdateDirective {
  cleanText: string;
  newCharacters: NewCharacterInput[];
  unlockCharacterIds: string[];
}

interface GameForUser extends GameConfig {
  encounteredCharacterIds: string[];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getAssistantCharacter(): Promise<Character> {
  const globalAssistant = await getGlobalAssistantConfig();
  if (!globalAssistant) {
    throw new Error("Global assistant configuration not found");
  }
  return {
    id: globalAssistant.id,
    name: globalAssistant.name,
    bio: globalAssistant.bio,
    definition: "",
    systemPrompt: globalAssistant.systemPrompt,
  };
}

function buildUserGameSnapshot(game: GameConfig): UserGameSnapshot {
  return {
    title: game.title,
    introText: game.introText,
    characters: game.characters.map((character) => ({ ...character })),
    encounteredCharacterIds: [],
  };
}

function getGameForUser(
  game: GameConfig,
  snapshot: UserGameSnapshot,
): GameForUser {
  return {
    ...game,
    ...snapshot,
    characters: snapshot.characters?.length
      ? snapshot.characters
      : game.characters,
    encounteredCharacterIds: snapshot.encounteredCharacterIds ?? [],
  };
}

function uniqueCharacterId(baseName: string, used: Set<string>): string {
  const base = slugify(baseName);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${index}`;
    index++;
  }
  used.add(candidate);
  return candidate;
}

function parseGameUpdateDirective(replyText: string): GameUpdateDirective {
  const match = replyText.match(
    /<game_update>\s*([\s\S]*?)\s*<\/game_update>/i,
  );

  if (!match) {
    return { cleanText: replyText.trim(), newCharacters: [], unlockCharacterIds: [] };
  }

  const before = replyText.slice(0, match.index).trimEnd();
  const after = replyText.slice((match.index ?? 0) + match[0].length).trimStart();
  const cleanText = `${before}${before && after ? "\n\n" : ""}${after}`.trim();

  try {
    const parsed = JSON.parse(match[1]) as {
      new_characters?: Array<{
        name?: string;
        bio?: string;
        definition?: string;
        systemPrompt?: string;
      }>;
      unlock_character_ids?: string[];
    };

    const newCharacters = (parsed.new_characters ?? [])
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        bio: String(item.bio ?? "").trim(),
        definition: String(item.definition ?? item.systemPrompt ?? "").trim(),
      }))
      .filter((item) => item.name && item.bio && item.definition)
      .slice(0, 3);

    const unlockCharacterIds = (parsed.unlock_character_ids ?? [])
      .map((id) => slugify(String(id ?? "").trim()))
      .filter(Boolean);

    return { cleanText, newCharacters, unlockCharacterIds };
  } catch {
    return { cleanText, newCharacters: [], unlockCharacterIds: [] };
  }
}

function mergeCharacters(
  existing: Character[],
  incoming: NewCharacterInput[],
): Character[] {
  if (incoming.length === 0) return existing;

  const usedIds = new Set(existing.map((character) => character.id));
  const existingByName = new Set(
    existing.map((character) => character.name.trim().toLowerCase()),
  );
  const merged = [...existing];

  for (const item of incoming) {
    const normalizedName = item.name.toLowerCase();
    if (existingByName.has(normalizedName)) continue;

    const id = uniqueCharacterId(item.name, usedIds);
    merged.push({
      id,
      name: item.name,
      bio: item.bio,
      definition: item.definition,
      systemPrompt: item.definition,
    });
    existingByName.add(normalizedName);
  }

  return merged;
}

function findCharacterById(
  characters: Character[],
  characterId: string,
): Character | null {
  const target = characterId.trim().toLowerCase();
  if (!target) return null;
  return characters.find((c) => c.id.toLowerCase() === target) ?? null;
}

export const handler = define.handlers({
  async POST(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) return json({ ok: false, error: "Unauthorized" }, 401);

    const userProfile = ctx.state.userProfile;
    if (!userProfile) return json({ ok: false, error: "Complete profile first" }, 409);

    const slug = ctx.params.slug;
    const game = await getGameBySlug(slug);
    if (!game || !game.active) return json({ ok: false, error: "Game not found" }, 404);

    let payload: MessageRequest;
    try {
      payload = await ctx.req.json() as MessageRequest;
    } catch {
      return json({ ok: false, error: "Invalid JSON payload" }, 400);
    }

    const text = (payload.text ?? "").trim();
    const characterId = String(payload.characterId ?? "").trim().toLowerCase();

    if (!text) return json({ ok: false, error: "Prompt cannot be empty" }, 400);
    if (text.length > 2500) return json({ ok: false, error: "Prompt is too long" }, 400);
    if (!characterId) return json({ ok: false, error: "Character is required" }, 400);

    const progress = await getUserProgress(userEmail, slug);
    const gameSnapshot = progress?.gameSnapshot ?? buildUserGameSnapshot(game);
    const gameForUser = getGameForUser(game, gameSnapshot);

    const assistantCharacter = await getAssistantCharacter();
    const runtimeCharacters = [
      assistantCharacter,
      ...gameForUser.characters.filter((c) => c.id !== assistantCharacter.id),
    ];

    const targetCharacter = findCharacterById(runtimeCharacters, characterId);
    if (!targetCharacter) return json({ ok: false, error: "Unknown character" }, 400);

    const transcriptBase = progress?.transcript ?? "";
    const events = parseTranscript(transcriptBase);
    const userEvent: TranscriptEvent = {
      role: "user",
      characterId: targetCharacter.id,
      characterName: targetCharacter.name,
      text,
      at: new Date().toISOString(),
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          sendEvent("ack", {
            userEvent,
            character: { id: targetCharacter.id, name: targetCharacter.name },
          });

          const providerOverride = gameForUser.isAdult ? "venice" : undefined;
          const replyResult = await streamCharacterReply(
            {
              game: gameForUser,
              character: targetCharacter,
              assistantId: assistantCharacter.id,
              events: [...events, userEvent],
              userPrompt: text,
              playerProfile: { name: userProfile.name, gender: userProfile.gender },
              providerOverride,
            },
            (delta) => {
              if (delta) sendEvent("delta", { text: delta });
            },
          );

          const rawReplyText = replyResult.text;

          // Deduct credits for this LLM call (fire-and-forget — don't block the response).
          const activeProvider = providerOverride ?? await getActiveLlmProvider();
          const creditsUsed = calculateCredits(activeProvider, replyResult.usage);
          console.log(
            `[credits] usage=${JSON.stringify(replyResult.usage)} creditsUsed=${creditsUsed} provider=${activeProvider}`,
          );
          deductUserCredits(userEmail, creditsUsed).catch((err) => {
            console.error(`[credits] Failed to deduct for ${userEmail}: ${err}`);
          });

          const parsedUpdate = parseGameUpdateDirective(rawReplyText);
          const visibleReply = parsedUpdate.cleanText || `(${targetCharacter.name}) ...`;

          const characterEvent: TranscriptEvent = {
            role: "character",
            characterId: targetCharacter.id,
            characterName: targetCharacter.name,
            text: visibleReply,
            at: new Date().toISOString(),
          };

          const appended = appendEvents(transcriptBase, [userEvent, characterEvent]);
          const updatedCharacters = mergeCharacters(
            gameForUser.characters,
            parsedUpdate.newCharacters,
          );

          const validCharacterIds = new Set([
            assistantCharacter.id,
            ...updatedCharacters.map((c) => c.id),
          ]);
          const encounteredCharacterIds = new Set(gameForUser.encounteredCharacterIds);
          if (validCharacterIds.has(targetCharacter.id)) {
            encounteredCharacterIds.add(targetCharacter.id);
          }
          for (const id of parsedUpdate.unlockCharacterIds) {
            if (validCharacterIds.has(id)) encounteredCharacterIds.add(id);
          }

          const nextSnapshot: UserGameSnapshot = {
            title: gameForUser.title,
            introText: gameForUser.introText,
            characters: updatedCharacters,
            encounteredCharacterIds: [...encounteredCharacterIds],
          };

          await saveUserProgress(userEmail, slug, {
            transcript: appended,
            updatedAt: new Date().toISOString(),
            gameSnapshot: nextSnapshot,
          });

          const responseCharacters = [
            { id: assistantCharacter.id, name: assistantCharacter.name, bio: assistantCharacter.bio },
            ...updatedCharacters
              .filter((c) => c.id !== assistantCharacter.id)
              .map((c) => ({ id: c.id, name: c.name, bio: c.bio })),
          ];

          sendEvent("final", {
            characterEvent,
            characters: responseCharacters,
            encounteredCharacterIds: nextSnapshot.encounteredCharacterIds,
          });
        } catch (error) {
          sendEvent("error", {
            error: error instanceof Error ? error.message : "Unable to complete message stream",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  },
});
