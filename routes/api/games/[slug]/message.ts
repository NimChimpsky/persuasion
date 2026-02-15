import { streamCharacterReply } from "../../../../lib/llm.ts";
import { slugify } from "../../../../lib/slug.ts";
import {
  getGameBySlug,
  getUserProgress,
  saveUserProgress,
} from "../../../../lib/store.ts";
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
  systemPrompt: string;
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

function buildUserGameSnapshot(game: GameConfig): UserGameSnapshot {
  return {
    title: game.title,
    introText: game.introText,
    plotPointsText: game.plotPointsText,
    characters: game.characters.map((character) => ({
      ...character,
    })),
    encounteredCharacterIds: [],
  };
}

function getGameForUser(
  game: GameConfig,
  snapshot: UserGameSnapshot | undefined,
): GameForUser {
  if (!snapshot) {
    return { ...game, encounteredCharacterIds: [] };
  }

  return {
    ...game,
    ...snapshot,
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
    return {
      cleanText: replyText.trim(),
      newCharacters: [],
      unlockCharacterIds: [],
    };
  }

  const before = replyText.slice(0, match.index).trimEnd();
  const after = replyText.slice((match.index ?? 0) + match[0].length)
    .trimStart();
  const cleanText = `${before}${before && after ? "\n\n" : ""}${after}`.trim();

  try {
    const parsed = JSON.parse(match[1]) as {
      new_characters?: Array<{
        name?: string;
        bio?: string;
        systemPrompt?: string;
      }>;
      unlock_character_ids?: string[];
    };

    const newCharacters = (parsed.new_characters ?? [])
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        bio: String(item.bio ?? "").trim(),
        systemPrompt: String(item.systemPrompt ?? "").trim(),
      }))
      .filter((item) => item.name && item.bio && item.systemPrompt)
      .slice(0, 3);

    const unlockCharacterIds = (parsed.unlock_character_ids ?? [])
      .map((id) => slugify(String(id ?? "").trim()))
      .filter(Boolean);

    return {
      cleanText,
      newCharacters,
      unlockCharacterIds,
    };
  } catch {
    return {
      cleanText,
      newCharacters: [],
      unlockCharacterIds: [],
    };
  }
}

function mergeCharacters(
  existing: Character[],
  incoming: NewCharacterInput[],
): Character[] {
  if (incoming.length === 0) {
    return existing;
  }

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
      systemPrompt: item.systemPrompt,
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
  return characters.find((character) =>
    character.id.toLowerCase() === target
  ) ??
    null;
}

export const handler = define.handlers({
  async POST(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const slug = ctx.params.slug;
    const game = await getGameBySlug(slug);
    if (!game || !game.active) {
      return json({ ok: false, error: "Game not found" }, 404);
    }

    let payload: MessageRequest;
    try {
      payload = await ctx.req.json() as MessageRequest;
    } catch {
      return json({ ok: false, error: "Invalid JSON payload" }, 400);
    }

    const text = (payload.text ?? "").trim();
    const characterId = String(payload.characterId ?? "").trim().toLowerCase();

    if (!text) {
      return json({ ok: false, error: "Prompt cannot be empty" }, 400);
    }
    if (text.length > 2500) {
      return json({ ok: false, error: "Prompt is too long" }, 400);
    }
    if (!characterId) {
      return json({ ok: false, error: "Character is required" }, 400);
    }

    const progress = await getUserProgress(userEmail, slug);
    const gameSnapshot = progress?.gameSnapshot ?? buildUserGameSnapshot(game);
    const gameForUser = getGameForUser(game, gameSnapshot);
    const targetCharacter = findCharacterById(
      gameForUser.characters,
      characterId,
    );
    if (!targetCharacter) {
      return json({ ok: false, error: "Unknown character" }, 400);
    }

    const events = parseTranscript(progress?.transcript ?? "");

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
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        try {
          sendEvent("ack", {
            userEvent,
            character: {
              id: targetCharacter.id,
              name: targetCharacter.name,
            },
          });

          const rawReplyText = await streamCharacterReply(
            {
              game: gameForUser,
              character: targetCharacter,
              events: [...events, userEvent],
              userPrompt: text,
            },
            (delta) => {
              if (!delta) return;
              sendEvent("delta", { text: delta });
            },
          );

          const parsedUpdate = parseGameUpdateDirective(rawReplyText);
          const visibleReply = parsedUpdate.cleanText ||
            `(${targetCharacter.name}) ...`;

          const characterEvent: TranscriptEvent = {
            role: "character",
            characterId: targetCharacter.id,
            characterName: targetCharacter.name,
            text: visibleReply,
            at: new Date().toISOString(),
          };

          const appended = appendEvents(progress?.transcript ?? "", [
            userEvent,
            characterEvent,
          ]);

          const updatedCharacters = mergeCharacters(
            gameForUser.characters,
            parsedUpdate.newCharacters,
          );
          const validCharacterIds = new Set(updatedCharacters.map((c) => c.id));
          const encounteredCharacterIds = new Set(
            gameForUser.encounteredCharacterIds,
          );

          if (validCharacterIds.has(targetCharacter.id)) {
            encounteredCharacterIds.add(targetCharacter.id);
          }
          for (const id of parsedUpdate.unlockCharacterIds) {
            if (validCharacterIds.has(id)) encounteredCharacterIds.add(id);
          }

          const nextSnapshot: UserGameSnapshot = {
            title: gameForUser.title,
            introText: gameForUser.introText,
            plotPointsText: gameForUser.plotPointsText,
            characters: updatedCharacters,
            encounteredCharacterIds: [...encounteredCharacterIds],
          };

          await saveUserProgress(userEmail, slug, {
            transcript: appended,
            updatedAt: new Date().toISOString(),
            gameSnapshot: nextSnapshot,
          });

          sendEvent("final", {
            characterEvent,
            characters: updatedCharacters.map((character) => ({
              id: character.id,
              name: character.name,
              bio: character.bio,
            })),
            encounteredCharacterIds: nextSnapshot.encounteredCharacterIds,
          });
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Unable to complete message stream";
          sendEvent("error", { error: message });
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
