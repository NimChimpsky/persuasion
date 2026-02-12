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

export default define.page<typeof handler>(function FindPage({ state }) {
  if (!state.userEmail) return null;

  state.title = "Persuasion | Find";

  return (
    <main class="page-shell">
      <div class="container stack">
        <section class="card stack" style="padding: 18px;">
          <h2 class="display">Find</h2>
          <p class="muted">
            Game discovery and search will be added here next.
          </p>
        </section>
      </div>
    </main>
  );
});
