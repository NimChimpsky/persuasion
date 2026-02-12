import { page } from "fresh";
import SiteHeader from "../components/SiteHeader.tsx";
import { getUserProgressMap, listGames } from "../lib/store.ts";
import { define } from "../utils.ts";

interface HomeData {
  games: Array<{
    slug: string;
    title: string;
    characterCount: number;
    updatedAt: string;
    hasProgress: boolean;
  }>;
}

export const handler = define.handlers<HomeData>({
  async GET(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const games = await listGames();
    const progressMap = await getUserProgressMap(
      userEmail,
      games.map((game) => game.slug),
    );

    return page({
      games: games.map((game) => ({
        slug: game.slug,
        title: game.title,
        characterCount: game.characterCount,
        updatedAt: game.updatedAt,
        hasProgress: progressMap.has(game.slug),
      })),
    });
  },
});

export default define.page<typeof handler>(function HomePage({ data, state }) {
  const userEmail = state.userEmail;
  if (!userEmail) {
    return null;
  }

  state.title = "Persuasion | Home";

  return (
    <main class="page-shell">
      <div class="container stack">
        <SiteHeader
          title="Persuasion"
          userEmail={userEmail}
          isAdmin={state.isAdmin}
          showHomeLink={false}
          showLogoutAllLink
        />

        <section class="stack">
          <h2 class="display">Active Games</h2>
          {data.games.length === 0
            ? <p class="notice">No games published yet.</p>
            : (
              <div class="cards-grid">
                {data.games.map((game) => (
                  <article key={game.slug} class="card game-card">
                    <h3>{game.title}</h3>
                    <p class="muted">/game/{game.slug}</p>
                    <p class="inline-meta">
                      {game.characterCount} character(s) · updated{" "}
                      {new Date(game.updatedAt).toLocaleString()}
                    </p>
                    <div class="action-row">
                      <a class="btn primary" href={`/game/${game.slug}`}>
                        {game.hasProgress ? "Continue" : "Start"}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>
    </main>
  );
});
