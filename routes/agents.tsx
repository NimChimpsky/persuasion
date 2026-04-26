import { page } from "fresh";
import { define } from "../utils.ts";

export const handler = define.handlers({
  GET(ctx) {
    if (!ctx.state.userEmail) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    return page({});
  },
});

export default define.page<typeof handler>(function AgentsPage({ state }) {
  if (!state.userEmail) return null;

  state.title = "Persuasion | Agent vs Agent";

  return (
    <main class="page-shell">
      <div class="container stack">
        <section class="agent-placeholder card">
          <p class="mode-kicker">Arena</p>
          <h1 class="display">Agent vs Agent</h1>
          <p class="muted">
            Build autonomous agents that try to extract secrets, and defend
            against other agents doing the same.
          </p>
          <p class="notice landing-notice">Coming soon.</p>
        </section>
      </div>
    </main>
  );
});
