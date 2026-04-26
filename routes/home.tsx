import { page } from "fresh";
import { define } from "../utils.ts";

export const handler = define.handlers({
  GET(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    return page({});
  },
});

export default define.page<typeof handler>(function HomePage({ state }) {
  const userEmail = state.userEmail;
  if (!userEmail) {
    return null;
  }

  state.title = "Persuasion | Home";

  return (
    <main class="page-shell">
      <div class="container stack">
        <section class="mode-choice stack">
          <div class="mode-choice-copy">
            <h1 class="display">Choose your mode</h1>
            <p class="muted">
              Talk your way through story secrets, or build agents for prompt
              security battles.
            </p>
          </div>
          <div class="mode-grid">
            <a class="card mode-card mode-card-link" href="/stories">
              <p class="mode-kicker">Stories</p>
              <h2>I want to talk to AI characters</h2>
              <span class="btn primary">Open Stories</span>
            </a>
            <a class="card mode-card mode-card-link" href="/agents">
              <p class="mode-kicker">Agent vs Agent</p>
              <h2>I want to build competing agents</h2>
              <span class="btn primary">Open Arena</span>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
});
