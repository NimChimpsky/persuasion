import { page } from "fresh";
import GameBoard from "../../islands/GameBoard.tsx";
import {
  buildInitialProgressState,
  resolveCharacterVisibility,
} from "../../lib/game_engine.ts";
import {
  getGameBySlug,
  getGlobalAssistantConfig,
  getUserProgress,
} from "../../lib/store.ts";
import { parseTranscript } from "../../shared/transcript.ts";
import type {
  PlotMilestone,
  ProgressState,
  UserGameSnapshot,
} from "../../shared/types.ts";
import { define } from "../../utils.ts";

interface CharacterForClient {
  id: string;
  name: string;
  bio: string;
  state: "hidden" | "locked" | "available" | "encountered";
}

interface GamePageData {
  slug: string;
  title: string;
  introText: string;
  characters: CharacterForClient[];
  events: ReturnType<typeof parseTranscript>;
  encounteredCharacterIds: string[];
  assistantId: string;
  progressState: ProgressState;
  plotMilestones: PlotMilestone[];
}

interface GameForUser {
  title: string;
  introText: string;
  plotPointsText: string;
  assistantId: string;
  plotMilestones: PlotMilestone[];
  characters: UserGameSnapshot["characters"];
  encounteredCharacterIds: string[];
  progressState: ProgressState;
}

function detectEncounteredCharacterIds(
  characterIds: Set<string>,
  events: ReturnType<typeof parseTranscript>,
): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.role === "character" && characterIds.has(event.characterId)) {
      ids.add(event.characterId);
    }
  }
  return [...ids];
}

function ensureFirstCharacterEncountered(
  encounteredCharacterIds: string[],
  characters: Array<{ id: string }>,
): string[] {
  if (characters.length === 0) return encounteredCharacterIds;
  const firstCharacterId = characters[0].id;
  if (!firstCharacterId) return encounteredCharacterIds;

  const encounteredSet = new Set(
    encounteredCharacterIds.map((id) => id.toLowerCase()),
  );
  if (encounteredSet.has(firstCharacterId.toLowerCase())) {
    return encounteredCharacterIds;
  }

  return [...encounteredCharacterIds, firstCharacterId];
}

function buildDefaultGameForUser(
  game: {
    title: string;
    introText: string;
    plotPointsText: string;
    plotMilestones: PlotMilestone[];
    characters: UserGameSnapshot["characters"];
  },
  assistantId: string,
): GameForUser {
  return {
    title: game.title,
    introText: game.introText,
    plotPointsText: game.plotPointsText,
    assistantId,
    plotMilestones: game.plotMilestones,
    characters: game.characters,
    encounteredCharacterIds: [],
    progressState: buildInitialProgressState(),
  };
}

export const handler = define.handlers<GamePageData>({
  async GET(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const slug = ctx.params.slug;
    const game = await getGameBySlug(slug);
    if (!game || !game.active) {
      return new Response("Game not found", { status: 404 });
    }
    if (!game.plotMilestones?.length) {
      return new Response(
        "Game configuration is invalid: plot milestones are required.",
        { status: 500 },
      );
    }

    const globalAssistant = await getGlobalAssistantConfig();
    if (!globalAssistant) {
      return new Response(
        "Global assistant configuration not found. Contact admin.",
        { status: 500 },
      );
    }

    const progress = await getUserProgress(userEmail, slug);
    const events = parseTranscript(progress?.transcript ?? "");

    const fallback = buildDefaultGameForUser(game, globalAssistant.id);
    const snapshot = progress?.gameSnapshot;
    const gameForUser: GameForUser = snapshot
      ? {
        ...fallback,
        ...snapshot,
        assistantId: snapshot.assistantId || fallback.assistantId,
        progressState: snapshot.progressState ?? fallback.progressState,
        plotMilestones: snapshot.plotMilestones?.length
          ? snapshot.plotMilestones
          : fallback.plotMilestones,
        characters: snapshot.characters?.length
          ? snapshot.characters
          : fallback.characters,
      }
      : fallback;

    const validCharacterIds = new Set(
      gameForUser.characters.map((character) => character.id),
    );
    const encounteredCharacterIdsRaw = gameForUser.encounteredCharacterIds
        ?.length
      ? gameForUser.encounteredCharacterIds
      : detectEncounteredCharacterIds(validCharacterIds, events);

    const encounteredCharacterIds = ensureFirstCharacterEncountered(
      encounteredCharacterIdsRaw,
      gameForUser.characters.filter((c) => {
        const vis = resolveCharacterVisibility(
          c,
          gameForUser.progressState,
          encounteredCharacterIdsRaw,
          gameForUser.plotMilestones,
        );
        return vis === "available" || vis === "encountered";
      }),
    );

    // Build display characters with visibility states
    const assistantCard: CharacterForClient = {
      id: globalAssistant.id,
      name: globalAssistant.name,
      bio: globalAssistant.bio,
      state: "available",
    };

    const displayCharacters: CharacterForClient[] = [assistantCard];
    for (const character of gameForUser.characters) {
      if (character.id === assistantCard.id) continue;

      const visibility = resolveCharacterVisibility(
        character,
        gameForUser.progressState,
        encounteredCharacterIds,
        gameForUser.plotMilestones,
      );

      if (visibility === "hidden") continue;

      if (visibility === "locked") {
        displayCharacters.push({
          id: character.id,
          name: "???",
          bio: "This person may become available as you investigate.",
          state: "locked",
        });
      } else {
        displayCharacters.push({
          id: character.id,
          name: character.name,
          bio: character.bio,
          state: visibility,
        });
      }
    }

    ctx.state.activeGameHeader = {
      slug,
      title: gameForUser.title,
    };

    return page({
      slug,
      title: gameForUser.title,
      introText: gameForUser.introText,
      characters: displayCharacters,
      events,
      encounteredCharacterIds,
      assistantId: gameForUser.assistantId,
      progressState: gameForUser.progressState,
      plotMilestones: gameForUser.plotMilestones,
    });
  },
});

export default define.page<typeof handler>(function GamePage({ data, state }) {
  const userEmail = state.userEmail;
  if (!userEmail) return null;

  state.title = `Persuasion | ${data.title}`;

  return (
    <main class="page-shell game-page-shell">
      <div class="container stack game-page-container">
        <GameBoard
          slug={data.slug}
          introText={data.introText}
          characters={data.characters}
          initialEvents={data.events}
          initialEncounteredCharacterIds={data.encounteredCharacterIds}
          initialAssistantId={data.assistantId}
          initialProgressState={data.progressState}
          initialPlotMilestones={data.plotMilestones}
        />
      </div>
    </main>
  );
});
