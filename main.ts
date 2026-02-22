import { App, staticFiles } from "fresh";
import { getSessionEmail } from "./lib/auth.ts";
import { isAdminEmail } from "./lib/env.ts";
import { getKv } from "./lib/kv.ts";
import { getUserProfile } from "./lib/store.ts";
import { resetAndSeedOliveFarmOnStartup } from "./lib/startup_reset.ts";
import { define, type State } from "./utils.ts";

export const app = new App<State>();

// Fail fast: this app requires persistent Deno KV.
await getKv();
// TEMPORARY EARLY-DEV RESET/SEED STARTUP FLOW.
// Controlled by RESET_GAME_STATE_ON_STARTUP in env.ts:
// - true  => wipe game data + reseed
// - false => seed-only upsert
// Runs in the background so the server starts immediately.
resetAndSeedOliveFarmOnStartup().catch((err) => {
  console.error("[startup-reset] fatal:", err);
});

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
  const userProfile = email ? await getUserProfile(email) : null;

  ctx.state.title = "Persuasion";
  ctx.state.userEmail = email;
  ctx.state.isAdmin = email ? isAdminEmail(email) : false;
  ctx.state.userProfile = userProfile;

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
