import { getUserCredits, getUserLastTopup } from "../../lib/store.ts";
import { json } from "../../lib/http.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return json({ error: "Unauthorized" }, 401);
    }
    const [balance, lastTopup] = await Promise.all([
      getUserCredits(email),
      getUserLastTopup(email),
    ]);
    return json({ balance, lastTopup });
  },
});
