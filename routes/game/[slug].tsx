import { page } from "fresh";
import GameBoard from "../../islands/GameBoard.tsx";
import { getGameBySlug, getUserProgress } from "../../lib/store.ts";
import { buildSidePanes } from "../../shared/game_ui.ts";
import { parseTranscript } from "../../shared/transcript.ts";
import { define } from "../../utils.ts";

interface GamePageData {
  slug: string;
  title: string;
  characters: Array<{ id: string; name: string }>;
  events: ReturnType<typeof parseTranscript>;
  sidePanes: ReturnType<typeof buildSidePanes>;
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

    return page({
      slug,
      title: gameForUser.title,
      characters: gameForUser.characters.map((character) => ({
        id: character.id,
        name: character.name,
      })),
      events,
      sidePanes: buildSidePanes(
        gameForUser.characters,
        gameForUser.plotPointsText,
        events,
      ),
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
        <GameBoard
          slug={data.slug}
          characters={data.characters}
          initialEvents={data.events}
          initialSidePanes={data.sidePanes}
        />
      </div>
    </main>
  );
});
