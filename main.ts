import { App, staticFiles } from "fresh";
import { getSessionEmail } from "./lib/auth.ts";
import { isAdminEmail } from "./lib/env.ts";
import { getKv } from "./lib/kv.ts";
import { getUserCredits, getUserProfile } from "./lib/store.ts";
import { startupSync } from "./lib/startup_reset.ts";
import { define, type State } from "./utils.ts";

export const app = new App<State>();

// Fail fast: this app requires persistent Deno KV.
await getKv();
// Phase 1 (awaited): wipe + basic seed from txt files. Fast — no LLM calls.
// Phase 2 (background): LLM hardening of character prompts, kicked off inside startupSync.
await startupSync();

app.use(staticFiles());

function isAllowedWithoutProfile(pathname: string): boolean {
  if (
    pathname === "/profile" || pathname === "/auth/logout" ||
    pathname === "/auth/logout-all"
  ) {
    return true;
  }

  return pathname.startsWith("/_frsh");
}

app.use(define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);
  const email = await getSessionEmail(ctx.req);
  const [userProfile, creditBalance] = email
    ? await Promise.all([getUserProfile(email), getUserCredits(email)])
    : [null, null];

  ctx.state.title = "Persuasion";
  ctx.state.userEmail = email;
  ctx.state.isAdmin = email ? isAdminEmail(email) : false;
  ctx.state.userProfile = userProfile;
  ctx.state.creditBalance = creditBalance;

  if (email && !userProfile && !isAllowedWithoutProfile(url.pathname)) {
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Complete profile first" }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const next = `${url.pathname}${url.search}`;
    const redirectUrl = new URL("/profile", url);
    redirectUrl.searchParams.set("next", next);
    return Response.redirect(redirectUrl, 303);
  }

  return await ctx.next();
}));

app.fsRoutes();
