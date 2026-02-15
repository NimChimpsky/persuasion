import { page } from "fresh";
import GameBoard from "../../islands/GameBoard.tsx";
import { getGameBySlug, getUserProgress } from "../../lib/store.ts";
import { parseTranscript } from "../../shared/transcript.ts";
import { define } from "../../utils.ts";

interface GamePageData {
  slug: string;
  title: string;
  introText: string;
  characters: Array<{ id: string; name: string; bio: string }>;
  events: ReturnType<typeof parseTranscript>;
  encounteredCharacterIds: string[];
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

    const progress = await getUserProgress(userEmail, slug);
    const events = parseTranscript(progress?.transcript ?? "");
    const gameForUser = progress?.gameSnapshot
      ? { ...game, ...progress.gameSnapshot }
      : game;
    const validCharacterIds = new Set(
      gameForUser.characters.map((character) => character.id),
    );
    const encounteredCharacterIds = progress?.gameSnapshot
      ?.encounteredCharacterIds ??
      detectEncounteredCharacterIds(validCharacterIds, events);

    return page({
      slug,
      title: gameForUser.title,
      introText: gameForUser.introText,
      characters: gameForUser.characters.map((character) => ({
        id: character.id,
        name: character.name,
        bio: character.bio,
      })),
      events,
      encounteredCharacterIds,
    });
  },
});

export default define.page<typeof handler>(function GamePage({ data, state }) {
  const userEmail = state.userEmail;
  if (!userEmail) return null;

  state.title = `Persuasion | ${data.title}`;

  return (
    <main class="page-shell">
      <div class="container stack">
        <section class="card game-intro">
          <h2>{data.title}</h2>
          <p>{data.introText}</p>
        </section>
        <GameBoard
          slug={data.slug}
          characters={data.characters}
          initialEvents={data.events}
          initialEncounteredCharacterIds={data.encounteredCharacterIds}
        />
      </div>
    </main>
  );
});
