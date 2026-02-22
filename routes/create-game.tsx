import { page } from "fresh";
import AdminGameForm from "../islands/AdminGameForm.tsx";
import { initializeGame } from "../lib/game_initializer.ts";
import { ensureUniqueIds, slugify } from "../lib/slug.ts";
import {
  createGame,
  getGameBySlug,
  getGlobalAssistantConfig,
  listGames,
} from "../lib/store.ts";
import type {
  Character,
  GameConfig,
} from "../shared/types.ts";
import { define } from "../utils.ts";

interface PublishData {
  games: Array<
    { slug: string; title: string; updatedAt: string; characterCount: number }
  >;
  createdSlug: string;
  error: string;
}

async function findAvailableSlug(baseSlug: string): Promise<string> {
  let attempt = baseSlug;
  let index = 2;

  while (await getGameBySlug(attempt)) {
    attempt = `${baseSlug}-${index}`;
    index++;
  }

  return attempt;
}

function deriveBioFromDefinition(definition: string): string {
  const firstSentence = definition.split(/[.!?]/)[0]?.trim() ?? "";
  const source = firstSentence || definition.trim();
  const maxLen = 140;
  return source.length <= maxLen ? source : `${source.slice(0, maxLen - 3)}...`;
}

function parseCharacters(form: FormData): Character[] {
  const rawCount = Number(form.get("characterCount") ?? 0);
  const count = Number.isFinite(rawCount)
    ? Math.max(0, Math.floor(rawCount))
    : 0;

  const names: string[] = [];
  const definitions: string[] = [];
  const secretKeys: string[] = [];

  for (let i = 0; i < count; i++) {
    const name = String(form.get(`characterName_${i}`) ?? "").trim();
    const definition = String(form.get(`characterDefinition_${i}`) ?? "").trim();
    const secretKey = String(form.get(`characterSecretKey_${i}`) ?? "").trim();
    if (!name || !definition) continue;

    if (secretKey && !definition.includes(secretKey)) continue;

    names.push(name);
    definitions.push(definition);
    secretKeys.push(secretKey);
  }

  const ids = ensureUniqueIds(names.map((name) => slugify(name)));

  return names.map((name, index) => ({
    id: ids[index],
    name,
    bio: deriveBioFromDefinition(definitions[index]),
    definition: definitions[index],
    systemPrompt: "",
    secretKey: secretKeys[index] || undefined,
  }));
}

export const handler = define.handlers<PublishData>({
  async GET(ctx) {
    if (!ctx.state.userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const url = new URL(ctx.req.url);
    const createdSlug = url.searchParams.get("created") ?? "";
    const error = url.searchParams.get("error") ?? "";

    const games = await listGames();

    return page({
      createdSlug,
      error,
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

    const form = await ctx.req.formData();
    const title = String(form.get("title") ?? "").trim();
    const introText = String(form.get("introText") ?? "").trim();
    const isAdult = String(form.get("isAdult") ?? "") === "on";
    const characters = parseCharacters(form);
    const assistant = await getGlobalAssistantConfig();

    if (!title || !introText || characters.length === 0) {
      return Response.redirect(
        new URL(
          "/create-game?error=Provide+title,+intro,+and+at+least+one+character",
          ctx.req.url,
        ),
        303,
      );
    }

    if (!assistant) {
      return Response.redirect(
        new URL(
          "/create-game?error=Global+assistant+not+configured.+Contact+admin.",
          ctx.req.url,
        ),
        303,
      );
    }

    const baseSlug = slugify(title);
    const slug = await findAvailableSlug(baseSlug);

    const now = new Date().toISOString();
    const gameConfig: GameConfig = {
      slug,
      title,
      introText,
      isAdult,
      initialized: false,
      assistant,
      characters,
      active: true,
      createdBy: ctx.state.userEmail,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await createGame(gameConfig);

      // Initialize game with hardened prompts
      const result = await initializeGame(gameConfig);
      const initializedGame: GameConfig = {
        ...gameConfig,
        characters: result.characters,
        initialized: true,
      };
      await createGame(initializedGame);
    } catch {
      return Response.redirect(
        new URL("/create-game?error=Unable+to+create+game", ctx.req.url),
        303,
      );
    }

    return Response.redirect(
      new URL(`/create-game?created=${slug}`, ctx.req.url),
      303,
    );
  },
});

export default define.page<typeof handler>(
  function PublishPage({ data, state }) {
    if (!state.userEmail) return null;

    state.title = "Persuasion | Create Game";

    return (
      <main class="page-shell">
        <div class="container stack">
          {data.createdSlug
            ? (
              <p class="notice good">
                Game created at{" "}
                <a href={`/game/${data.createdSlug}`}>
                  /game/{data.createdSlug}
                </a>
              </p>
            )
            : null}

          {data.error ? <p class="notice bad">{data.error}</p> : null}

          <AdminGameForm action="/create-game" />

          <section class="stack">
            <h2 class="display">Published Games</h2>
            {data.games.length === 0
              ? <p class="notice">No games yet.</p>
              : (
                <div class="cards-grid">
                  {data.games.map((game) => (
                    <article class="card game-card" key={game.slug}>
                      <h3>{game.title}</h3>
                      <p class="muted">/game/{game.slug}</p>
                      <p class="inline-meta">
                        {game.characterCount} character(s) · updated{" "}
                        {new Date(game.updatedAt).toLocaleString()}
                      </p>
                      <a class="btn ghost" href={`/game/${game.slug}`}>
                        Open game
                      </a>
                    </article>
                  ))}
                </div>
              )}
          </section>
        </div>
      </main>
    );
  },
);
