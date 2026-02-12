import { page } from "fresh";
import { isAdminEmail } from "../lib/env.ts";
import { deleteGameBySlug, listGames } from "../lib/store.ts";
import { define } from "../utils.ts";

interface AdminData {
  games: Array<
    { slug: string; title: string; updatedAt: string; characterCount: number }
  >;
  message: string;
  error: string;
  forbidden: boolean;
}

function adminRedirect(ctx: { req: Request }, params: {
  message?: string;
  error?: string;
}): Response {
  const url = new URL("/admin", ctx.req.url);
  if (params.message) url.searchParams.set("message", params.message);
  if (params.error) url.searchParams.set("error", params.error);
  return Response.redirect(url, 303);
}

export const handler = define.handlers<AdminData>({
  async GET(ctx) {
    if (!ctx.state.userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }
    if (!ctx.state.isAdmin) {
      return page(
        {
          message: "",
          error: "",
          forbidden: true,
          games: [],
        },
        { status: 403 },
      );
    }

    const url = new URL(ctx.req.url);
    const message = url.searchParams.get("message") ?? "";
    const error = url.searchParams.get("error") ?? "";
    const games = await listGames();

    return page({
      message,
      error,
      forbidden: false,
      games: games.map((game) => ({
        slug: game.slug,
        title: game.title,
        updatedAt: game.updatedAt,
        characterCount: game.characterCount,
      })),
    });
  },

  async POST(ctx) {
    if (!ctx.state.userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }
    if (!ctx.state.isAdmin) {
      return Response.redirect(
        new URL("/admin?error=Admin+access+required", ctx.req.url),
        303,
      );
    }

    const form = await ctx.req.formData();
    const action = String(form.get("action") ?? "");

    if (action === "delete_game") {
      const slug = String(form.get("gameSlug") ?? "").trim();
      if (!slug) {
        return adminRedirect(ctx, { error: "Enter a game slug to delete." });
      }

      const deleted = await deleteGameBySlug(slug);
      if (!deleted) {
        return adminRedirect(ctx, { error: "Game slug not found." });
      }

      return adminRedirect(ctx, { message: `Deleted game: ${slug}` });
    }

    return adminRedirect(ctx, { error: "Unknown admin action." });
  },
});

export default define.page<typeof handler>(function AdminPage({ data, state }) {
  if (!state.userEmail) return null;

  state.title = "Persuasion | Admin";

  return (
    <main class="page-shell">
      <div class="container stack">
        {data.forbidden
          ? (
            <section class="card stack" style="padding: 18px;">
              <h2 class="display">Admin</h2>
              <p class="notice bad">
                Admin access required.
              </p>
            </section>
          )
          : null}

        {data.message ? <p class="notice good">{data.message}</p> : null}
        {data.error ? <p class="notice bad">{data.error}</p> : null}

        {!data.forbidden
          ? (
            <section class="card stack" style="padding: 16px;">
              <h2 class="display">Delete Game</h2>
              <form method="POST" action="/admin" class="form-grid">
                <input type="hidden" name="action" value="delete_game" />
                <label>
                  Game slug
                  <input
                    type="text"
                    name="gameSlug"
                    placeholder="the-last-cipher"
                    required
                  />
                </label>
                <div class="action-row">
                  <button class="btn primary" type="submit">Delete game</button>
                </div>
              </form>
            </section>
          )
          : null}

        {!data.forbidden
          ? (
            <section class="stack">
              <h2 class="display">Published Games</h2>
              {data.games.length === 0
                ? <p class="notice">No games yet.</p>
                : (
                  <div class="cards-grid">
                    {data.games.map((game) => (
                      <article class="card game-card" key={game.slug}>
                        <h3>{game.title}</h3>
                        <p class="muted">Slug: {game.slug}</p>
                        <p class="inline-meta">
                          {game.characterCount} character(s) · updated{" "}
                          {new Date(game.updatedAt).toLocaleString()}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
            </section>
          )
          : null}
      </div>
    </main>
  );
});
