import {
  clearUserProgressForGame,
  getGameBySlug,
} from "../../../../lib/store.ts";
import { define } from "../../../../utils.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const handler = define.handlers({
  async POST(ctx) {
    const userEmail = ctx.state.userEmail;
    if (!userEmail) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const slug = ctx.params.slug;
    const game = await getGameBySlug(slug);
    if (!game || !game.active) {
      return json({ ok: false, error: "Game not found" }, 404);
    }

    await clearUserProgressForGame(userEmail, slug);
    return json({ ok: true });
  },
});
