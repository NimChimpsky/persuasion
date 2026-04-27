import { createMagicToken, normalizeEmail } from "../../lib/auth.ts";
import { sendMagicLinkEmail } from "../../lib/email.ts";
import { env } from "../../lib/env.ts";
import { isJsonRequest, json, readJsonBody } from "../../lib/http.ts";
import { isValidEmail } from "../../shared/validation.ts";
import { define } from "../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const expectsJson = isJsonRequest(ctx.req);
    try {
      if (!env.resendApiKey) {
        if (expectsJson) {
          return json(
            {
              ok: false,
              error: "Email sign-in is disabled in this environment.",
            },
            503,
          );
        }
        return Response.redirect(
          new URL(
            "/?error=Email+sign-in+is+disabled+in+this+environment",
            ctx.req.url,
          ),
          303,
        );
      }

      let emailRaw = "";
      if (
        (ctx.req.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      ) {
        const payload = await readJsonBody<{ email?: string }>(ctx.req);
        if (!payload.ok) {
          return json({ ok: false, error: "Invalid JSON payload." }, 400);
        }
        emailRaw = String(payload.value.email ?? "");
      } else {
        const form = await ctx.req.formData();
        emailRaw = String(form.get("email") ?? "");
      }

      const email = normalizeEmail(emailRaw);

      if (!isValidEmail(email)) {
        if (expectsJson) {
          return json(
            { ok: false, error: "Please enter a valid email address." },
            400,
          );
        }
        return Response.redirect(
          new URL("/?error=Please+enter+a+valid+email", ctx.req.url),
          303,
        );
      }

      const token = await createMagicToken(email);
      const verifyUrl = new URL("/auth/verify", env.appBaseUrl);
      verifyUrl.searchParams.set("token", token);

      await sendMagicLinkEmail(email, verifyUrl.toString());

      if (expectsJson) {
        return json({
          ok: true,
          message: "we sent a link to your inbox",
        });
      }

      const redirectUrl = new URL("/", ctx.req.url);
      redirectUrl.searchParams.set("sent", "1");

      return Response.redirect(redirectUrl, 303);
    } catch (error) {
      console.error("request-link error:", error);
      if (expectsJson) {
        return json(
          { ok: false, error: "Unable to send email right now." },
          500,
        );
      }
      return Response.redirect(
        new URL("/?error=Unable+to+send+email+right+now", ctx.req.url),
        303,
      );
    }
  },
});
