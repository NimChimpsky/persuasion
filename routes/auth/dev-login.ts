import {
  createSession,
  normalizeEmail,
  setSessionCookie,
  USER_BLOCKED_ERROR,
} from "../../lib/auth.ts";
import { canUseLocalDevAuth } from "../../lib/dev_auth.ts";
import { env } from "../../lib/env.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);

    if (!canUseLocalDevAuth(url)) {
      return new Response("Not Found", { status: 404 });
    }

    const email = normalizeEmail(env.localDevAuthEmail);
    if (!email || !email.includes("@")) {
      return Response.redirect(
        new URL("/?error=Invalid+dev+login+email", url),
        303,
      );
    }

    let sessionId = "";
    try {
      sessionId = await createSession(email);
    } catch (error) {
      if (error instanceof Error && error.message === USER_BLOCKED_ERROR) {
        return Response.redirect(
          new URL("/?error=This+account+is+blocked", url),
          303,
        );
      }
      throw error;
    }
    const headers = new Headers();
    setSessionCookie(headers, sessionId, url.protocol === "https:");
    headers.set("location", "/home");

    return new Response(null, { status: 303, headers });
  },
});
