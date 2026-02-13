import { generateCharacterReply } from "../../../../lib/llm.ts";
import {
  createNarratorCharacter,
  NARRATOR_ID,
} from "../../../../shared/narrator.ts";
import {
  getGameBySlug,
  getUserProgress,
  saveUserProgress,
} from "../../../../lib/store.ts";
import { buildSidePanes } from "../../../../shared/game_ui.ts";
import {
  appendEvents,
  parseTranscript,
} from "../../../../shared/transcript.ts";
import type {
  GameConfig,
  TranscriptEvent,
  UserGameSnapshot,
} from "../../../../shared/types.ts";
import { define } from "../../../../utils.ts";

interface MessageRequest {
  text: string;
  targetCharacterId?: string;
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
    plotPointsText: game.plotPointsText,
    narratorPrompt: game.narratorPrompt,
    characters: game.characters.map((character) => ({
      ...character,
    })),
  };
}

function getGameForUser(
  game: GameConfig,
  snapshot: UserGameSnapshot | undefined,
): GameConfig {
  if (!snapshot) return game;
  return { ...game, ...snapshot };
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
    const targetCharacterId = (payload.targetCharacterId ?? "").trim()
      .toLowerCase();

    if (!text) {
      return json({ ok: false, error: "Prompt cannot be empty" }, 400);
    }
    if (text.length > 2500) {
      return json({ ok: false, error: "Prompt is too long" }, 400);
    }

    const progress = await getUserProgress(userEmail, slug);
    const gameSnapshot = progress?.gameSnapshot ?? buildUserGameSnapshot(game);
    const gameForUser = getGameForUser(game, gameSnapshot);

    const narratorCharacter = createNarratorCharacter(
      gameForUser.narratorPrompt,
    );
    const targetCharacter =
      !targetCharacterId || targetCharacterId === NARRATOR_ID
        ? narratorCharacter
        : gameForUser.characters.find((character) =>
          character.id.toLowerCase() === targetCharacterId
        ) ?? narratorCharacter;
    const events = parseTranscript(progress?.transcript ?? "");

    const userEvent: TranscriptEvent = {
      role: "user",
      characterId: targetCharacter.id,
      characterName: targetCharacter.name,
      text,
      at: new Date().toISOString(),
    };

    const replyText = await generateCharacterReply({
      game: gameForUser,
      character: targetCharacter,
      events: [...events, userEvent],
      userPrompt: text,
    });

    const characterEvent: TranscriptEvent = {
      role: "character",
      characterId: targetCharacter.id,
      characterName: targetCharacter.name,
      text: replyText,
      at: new Date().toISOString(),
    };

    const appended = appendEvents(progress?.transcript ?? "", [
      userEvent,
      characterEvent,
    ]);

    await saveUserProgress(userEmail, slug, {
      transcript: appended,
      updatedAt: new Date().toISOString(),
      gameSnapshot,
    });

    const updatedEvents = [...events, userEvent, characterEvent];

    return json({
      ok: true,
      events: [userEvent, characterEvent],
      sidePanes: buildSidePanes(
        gameForUser.characters,
        gameForUser.plotPointsText,
        updatedEvents,
      ),
    });
  },
});
