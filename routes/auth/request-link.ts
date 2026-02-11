import { createMagicToken, normalizeEmail } from "../../lib/auth.ts";
import { sendMagicLinkEmail } from "../../lib/email.ts";
import { env } from "../../lib/env.ts";
import { define } from "../../utils.ts";

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isJsonRequest(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  const contentType = req.headers.get("content-type") ?? "";
  return accept.includes("application/json") ||
    contentType.includes("application/json");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const handler = define.handlers({
  async POST(ctx) {
    const expectsJson = isJsonRequest(ctx.req);
    try {
      let emailRaw = "";
      if (
        (ctx.req.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      ) {
        const payload = await ctx.req.json() as { email?: string };
        emailRaw = String(payload.email ?? "");
      } else {
        const form = await ctx.req.formData();
        emailRaw = String(form.get("email") ?? "");
      }

      const email = normalizeEmail(emailRaw);

      if (!BASIC_EMAIL_REGEX.test(email)) {
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
      const verifyUrl = new URL("/auth/verify", ctx.req.url);
      verifyUrl.searchParams.set("token", token);

      const result = await sendMagicLinkEmail(email, verifyUrl.toString());
      const previewLink = !result.delivered && env.magicLinkPreview
        ? verifyUrl.toString()
        : "";

      if (!result.delivered && !env.magicLinkPreview) {
        if (expectsJson) {
          return json(
            {
              ok: false,
              error:
                "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
            },
            500,
          );
        }
        return Response.redirect(
          new URL(
            "/?error=Email+delivery+is+not+configured.+Set+RESEND_API_KEY+and+EMAIL_FROM",
            ctx.req.url,
          ),
          303,
        );
      }

      if (expectsJson) {
        return json({
          ok: true,
          message: "we sent a link to your inbox - it is valid for 1hr",
          previewLink,
        });
      }

      const redirectUrl = new URL("/", ctx.req.url);
      redirectUrl.searchParams.set("sent", "1");

      if (previewLink) {
        redirectUrl.searchParams.set("preview", previewLink);
      }

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
