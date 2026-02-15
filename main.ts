import { App, staticFiles } from "fresh";
import { getSessionEmail } from "./lib/auth.ts";
import { isAdminEmail } from "./lib/env.ts";
import { getKv } from "./lib/kv.ts";
import { resetAndSeedOliveFarmOnStartup } from "./lib/startup_reset.ts";
import { define, type State } from "./utils.ts";

export const app = new App<State>();

// Fail fast: this app requires persistent Deno KV.
await getKv();
// TEMPORARY EARLY-DEV RESET/SEED STARTUP FLOW.
// Controlled by RESET_GAME_STATE_ON_STARTUP in env.ts:
// - true  => wipe game data + reseed
// - false => seed-only upsert
await resetAndSeedOliveFarmOnStartup();

app.use(staticFiles());

app.use(define.middleware(async (ctx) => {
  const email = await getSessionEmail(ctx.req);

  ctx.state.title = "Persuasion";
  ctx.state.userEmail = email;
  ctx.state.isAdmin = email ? isAdminEmail(email) : false;

  return await ctx.next();
}));

app.fsRoutes();
