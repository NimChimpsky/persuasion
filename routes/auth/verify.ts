import {
  consumeMagicToken,
  createSession,
  setSessionCookie,
  USER_BLOCKED_ERROR,
} from "../../lib/auth.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!token) {
      return Response.redirect(
        new URL("/?error=Missing+token", ctx.req.url),
        303,
      );
    }

    const email = await consumeMagicToken(token);
    if (!email) {
      return Response.redirect(
        new URL("/?error=Invalid+or+expired+token", ctx.req.url),
        303,
      );
    }

    let sessionId = "";
    try {
      sessionId = await createSession(email);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === USER_BLOCKED_ERROR
      ) {
        return Response.redirect(
          new URL("/?error=This+account+is+blocked", ctx.req.url),
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
