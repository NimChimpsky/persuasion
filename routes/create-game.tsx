import { page } from "fresh";
import AdminGameForm from "../islands/AdminGameForm.tsx";
import { GLOBAL_ASSISTANT_SYSTEM_PROMPT } from "../lib/assistant_system_prompt.ts";
import { ensureUniqueIds, slugify } from "../lib/slug.ts";
import { createGame, getGameBySlug, listGames } from "../lib/store.ts";
import type {
  AssistantConfig,
  Character,
  GameConfig,
  PlotMilestone,
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

function parseCharacters(form: FormData): Character[] {
  const rawCount = Number(form.get("characterCount") ?? 0);
  const count = Number.isFinite(rawCount)
    ? Math.max(0, Math.floor(rawCount))
    : 0;

  const names: string[] = [];
  const bios: string[] = [];
  const prompts: string[] = [];

  for (let i = 0; i < count; i++) {
    const name = String(form.get(`characterName_${i}`) ?? "").trim();
    const bio = String(form.get(`characterBio_${i}`) ?? "").trim();
    const prompt = String(form.get(`characterPrompt_${i}`) ?? "").trim();
    if (!name || !bio || !prompt) continue;
    names.push(name);
    bios.push(bio);
    prompts.push(prompt);
  }

  const ids = ensureUniqueIds(names.map((name) => slugify(name)));

  return names.map((name, index) => ({
    id: ids[index],
    name,
    bio: bios[index],
    systemPrompt: prompts[index],
  }));
}

function parseMilestones(form: FormData): PlotMilestone[] {
  const rawCount = Number(form.get("milestoneCount") ?? 0);
  const count = Number.isFinite(rawCount)
    ? Math.max(0, Math.floor(rawCount))
    : 0;

  const titles: string[] = [];
  const descriptions: string[] = [];

  for (let i = 0; i < count; i++) {
    const title = String(form.get(`milestoneTitle_${i}`) ?? "").trim();
    const description = String(form.get(`milestoneDescription_${i}`) ?? "")
      .trim();
    if (!title || !description) continue;
    titles.push(title);
    descriptions.push(description);
  }

  const ids = ensureUniqueIds(titles.map((title) => slugify(title)));
  return titles.map((title, index) => ({
    id: ids[index],
    title,
    description: descriptions[index],
  }));
}

function parseAssistant(form: FormData): AssistantConfig | null {
  const name = String(form.get("assistantName") ?? "").trim();
  const bio = String(form.get("assistantBio") ?? "").trim();
  if (!name || !bio) return null;
  return {
    id: slugify(name),
    name,
    bio,
    systemPrompt: GLOBAL_ASSISTANT_SYSTEM_PROMPT,
  };
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
    const plotPointsText = String(form.get("plotPointsText") ?? "").trim();
    const assistant = parseAssistant(form);
    const plotMilestones = parseMilestones(form);
    const characters = parseCharacters(form);

    if (
      !title || !introText || characters.length === 0 || !assistant ||
      plotMilestones.length === 0
    ) {
      return Response.redirect(
        new URL(
          "/create-game?error=Provide+title,+intro,+assistant,+milestones,+and+at+least+one+character",
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
      plotPointsText,
      assistant,
      plotMilestones,
      characters,
      active: true,
      createdBy: ctx.state.userEmail,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await createGame(gameConfig);
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
