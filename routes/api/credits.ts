import { getUserCredits, getUserLastTopup } from "../../lib/store.ts";
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
    const [balance, lastTopup] = await Promise.all([
      getUserCredits(email),
      getUserLastTopup(email),
    ]);
    return new Response(JSON.stringify({ balance, lastTopup }), {
      headers: { "content-type": "application/json" },
    });
  },
});
