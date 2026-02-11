import { createMagicToken, normalizeEmail } from "../../lib/auth.ts";
import { sendMagicLinkEmail } from "../../lib/email.ts";
import { env } from "../../lib/env.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const emailRaw = String(form.get("email") ?? "");
    const email = normalizeEmail(emailRaw);

    if (!email || !email.includes("@")) {
      return Response.redirect(
        new URL("/?error=Please+enter+a+valid+email", ctx.req.url),
        303,
      );
    }

    const token = await createMagicToken(email);
    const verifyUrl = new URL("/auth/verify", ctx.req.url);
    verifyUrl.searchParams.set("token", token);

    try {
      const result = await sendMagicLinkEmail(email, verifyUrl.toString());
      const redirectUrl = new URL("/", ctx.req.url);
      redirectUrl.searchParams.set("sent", "1");

      if (!result.delivered && env.magicLinkPreview) {
        redirectUrl.searchParams.set("preview", verifyUrl.toString());
      }

      return Response.redirect(redirectUrl, 303);
    } catch {
      return Response.redirect(
        new URL("/?error=Unable+to+send+email+right+now", ctx.req.url),
        303,
      );
    }
  },
});
