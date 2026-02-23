import { getUserCredits } from "../../lib/store.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const balance = await getUserCredits(email);
    return new Response(JSON.stringify({ balance }), {
      headers: { "content-type": "application/json" },
    });
  },
});
