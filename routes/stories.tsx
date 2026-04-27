import { page } from "fresh";
import GameCards from "../components/GameCards.tsx";
import { listGames } from "../lib/store.ts";
import { type GameSummary, toGameSummary } from "../shared/game.ts";
import { define } from "../utils.ts";

interface StoriesData {
  games: GameSummary[];
}

export const handler = define.handlers<StoriesData>({
  async GET(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const games = await listGames();
    return page({
      games: games.map(toGameSummary),
    });
  },
});

export default define.page<typeof handler>(
  function StoriesPage({ data, state }) {
    const userEmail = state.userEmail;
    if (!userEmail) {
      return null;
    }

    state.title = "Persuasion | Stories";

    return (
      <main class="page-shell">
        <div class="container stack">
          <section class="stack">
            <div class="section-heading-row">
              <div>
                <h1 class="display">Stories</h1>
                <p class="muted">Talk to characters, uncover secrets.</p>
              </div>
              <a class="btn primary" href="/create-game">Create Story</a>
            </div>
            <GameCards
              games={data.games}
              emptyText="No stories published yet."
            />
          </section>
        </div>
      </main>
    );
  },
);
