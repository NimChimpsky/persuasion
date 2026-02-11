import { clearSessionCookie, destroySession } from "../../lib/auth.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await destroySession(ctx.req);

    const headers = new Headers();
    clearSessionCookie(headers);
    headers.set("location", "/");

    return new Response(null, { status: 303, headers });
  },
});
