import { page } from "fresh";
import {
  type BlockedUserRecord,
  blockUser,
  destroyAllSessionsForEmail,
  listBlockedUsers,
  normalizeEmail,
} from "../lib/auth.ts";
import { isAdminEmail } from "../lib/env.ts";
import { deleteGameBySlug, listGames } from "../lib/store.ts";
import { define } from "../utils.ts";

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AdminData {
  games: Array<
    { slug: string; title: string; updatedAt: string; characterCount: number }
  >;
  blockedUsers: BlockedUserRecord[];
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
          blockedUsers: [],
          games: [],
        },
        { status: 403 },
      );
    }

    const url = new URL(ctx.req.url);
    const message = url.searchParams.get("message") ?? "";
    const error = url.searchParams.get("error") ?? "";
    const games = await listGames();
    const blockedUsers = await listBlockedUsers();

    return page({
      message,
      error,
      forbidden: false,
      blockedUsers,
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

    if (action === "block_user") {
      const rawEmail = String(form.get("userEmail") ?? "");
      const email = normalizeEmail(rawEmail);
      if (!BASIC_EMAIL_REGEX.test(email)) {
        return adminRedirect(ctx, { error: "Enter a valid user email." });
      }
      if (email === ctx.state.userEmail) {
        return adminRedirect(ctx, {
          error: "You cannot block your own account.",
        });
      }
      if (isAdminEmail(email)) {
        return adminRedirect(ctx, { error: "Cannot block an admin email." });
      }

      await blockUser(email, ctx.state.userEmail);
      await destroyAllSessionsForEmail(email);

      return adminRedirect(ctx, { message: `Blocked user: ${email}` });
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
            <section class="card stack" style="padding: 16px;">
              <h2 class="display">Block User</h2>
              <form method="POST" action="/admin" class="form-grid">
                <input type="hidden" name="action" value="block_user" />
                <label>
                  User email
                  <input
                    type="email"
                    name="userEmail"
                    placeholder="player@example.com"
                    required
                  />
                </label>
                <div class="action-row">
                  <button class="btn primary" type="submit">Block user</button>
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

        {!data.forbidden
          ? (
            <section class="stack">
              <h2 class="display">Blocked Users</h2>
              {data.blockedUsers.length === 0
                ? <p class="notice">No blocked users.</p>
                : (
                  <div class="cards-grid">
                    {data.blockedUsers.map((user) => (
                      <article class="card game-card" key={user.email}>
                        <h3>{user.email}</h3>
                        <p class="inline-meta">
                          blocked by {user.blockedBy} on{" "}
                          {new Date(user.blockedAt).toLocaleString()}
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
