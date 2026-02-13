import { page } from "fresh";
import {
  getActiveLlmProvider,
  getLlmProviderConfig,
  isLlmProvider,
  listLlmProviderOptions,
  type LlmProvider,
  type LlmProviderOption,
  setActiveLlmProvider,
} from "../lib/llm_provider.ts";
import { deleteGameBySlug, listGames } from "../lib/store.ts";
import { define } from "../utils.ts";

interface AdminData {
  games: Array<
    { slug: string; title: string; updatedAt: string; characterCount: number }
  >;
  currentLlmProvider: LlmProvider;
  llmProviderOptions: LlmProviderOption[];
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
          currentLlmProvider: "deepseek",
          llmProviderOptions: listLlmProviderOptions(),
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
    const currentLlmProvider = await getActiveLlmProvider();
    const games = await listGames();

    return page({
      currentLlmProvider,
      llmProviderOptions: listLlmProviderOptions(),
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
    const intent = String(form.get("intent") ?? "");

    if (intent === "delete_game") {
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

    if (intent === "set_llm_provider") {
      const provider = String(form.get("provider") ?? "").trim().toLowerCase();
      if (!isLlmProvider(provider)) {
        return adminRedirect(ctx, { error: "Select a valid LLM provider." });
      }

      await setActiveLlmProvider(provider, ctx.state.userEmail);
      const providerLabel = getLlmProviderConfig(provider).label;
      return adminRedirect(ctx, {
        message: `LLM provider switched to ${providerLabel}.`,
      });
    }

    return adminRedirect(ctx, { error: "Unknown admin action." });
  },
});

export default define.page<typeof handler>(function AdminPage({ data, state }) {
  if (!state.userEmail) return null;

  state.title = "Persuasion | Admin";
  const currentProviderConfig = getLlmProviderConfig(data.currentLlmProvider);
  const providerMessage = data.message.startsWith("LLM provider switched to")
    ? data.message
    : "";
  const providerError = data.error === "Select a valid LLM provider."
    ? data.error
    : "";
  const globalMessage = providerMessage ? "" : data.message;
  const globalError = providerError ? "" : data.error;
  const providerFeedbackText = providerError || providerMessage || "\u00A0";
  const providerFeedbackClass = `provider-feedback-slot ${
    providerError
      ? "is-error is-visible"
      : providerMessage
      ? "is-success is-visible"
      : ""
  }`;

  return (
    <main class="page-shell">
      <div class="container stack">
        {data.forbidden
          ? (
            <section class="stack">
              <h2 class="display">Admin</h2>
              <p class="notice bad">
                Admin access required.
              </p>
            </section>
          )
          : null}

        {globalMessage ? <p class="notice good">{globalMessage}</p> : null}
        {globalError ? <p class="notice bad">{globalError}</p> : null}

        {!data.forbidden
          ? (
            <section class="stack">
              <h2 class="display">LLM Provider</h2>
              <div class="form-grid card" style="padding: 16px;">
                <div class="provider-toolbar">
                  <div class="action-row provider-buttons">
                    {data.llmProviderOptions.map((option) => (
                      <form
                        key={option.id}
                        method="POST"
                        action="/admin"
                        style="display: inline;"
                      >
                        <input
                          type="hidden"
                          name="intent"
                          value="set_llm_provider"
                        />
                        <input
                          type="hidden"
                          name="provider"
                          value={option.id}
                        />
                        <button
                          class={`btn ${
                            data.currentLlmProvider === option.id
                              ? "primary"
                              : "ghost"
                          }`}
                          type="submit"
                        >
                          {option.label}
                        </button>
                      </form>
                    ))}
                  </div>
                  <p class={providerFeedbackClass} aria-live="polite">
                    {providerFeedbackText}
                  </p>
                </div>
                <p class="muted">
                  Current: {currentProviderConfig.label} (
                  <code>{currentProviderConfig.model}</code>)
                </p>
                <p class="muted">
                  {data.llmProviderOptions.map((option) =>
                    `${option.label} (${
                      getLlmProviderConfig(option.id).model
                    }): ${option.configured ? "configured" : "missing API key"}`
                  ).join(" · ")}
                </p>
              </div>
            </section>
          )
          : null}

        {!data.forbidden
          ? (
            <section class="stack">
              <h2 class="display">Delete Game</h2>
              <form
                method="POST"
                action="/admin"
                class="form-grid card"
                style="padding: 16px;"
              >
                <input type="hidden" name="intent" value="delete_game" />
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
