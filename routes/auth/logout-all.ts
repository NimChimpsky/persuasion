import {
  clearSessionCookie,
  destroyAllSessionsForEmail,
} from "../../lib/auth.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const userEmail = ctx.state.userEmail;

    if (userEmail) {
      await destroyAllSessionsForEmail(userEmail);
    }

    const headers = new Headers();
    clearSessionCookie(headers);
    headers.set("location", "/");

    return new Response(null, { status: 303, headers });
  },
});
