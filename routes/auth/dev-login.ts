import {
  createSession,
  normalizeEmail,
  setSessionCookie,
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

    const email = normalizeEmail(
      url.searchParams.get("email") ?? env.localDevAuthEmail,
    );
    if (!email || !email.includes("@")) {
      return Response.redirect(
        new URL("/?error=Invalid+dev+login+email", url),
        303,
      );
    }

    const sessionId = await createSession(email);
    const headers = new Headers();
    setSessionCookie(headers, sessionId, url.protocol === "https:");
    headers.set("location", "/home");

    return new Response(null, { status: 303, headers });
  },
});
