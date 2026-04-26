import { App, staticFiles } from "fresh";
import { getSessionEmail } from "./lib/auth.ts";
import { isAdminEmail } from "./lib/env.ts";
import { getKv } from "./lib/kv.ts";
import {
  getUserCredits,
  getUserLastTopup,
  getUserProfile,
} from "./lib/store.ts";
import { startupSync } from "./lib/startup_reset.ts";
import { define, type State } from "./utils.ts";

export const app = new App<State>();

// Fail fast: this app requires persistent Deno KV.
await getKv();
// Phase 1 (awaited): wipe + basic seed from txt files. Fast — no LLM calls.
// Phase 2 (background): LLM hardening of character prompts, kicked off inside startupSync.
await startupSync();

app.use(staticFiles());

app.use(define.middleware(async (ctx) => {
  const email = await getSessionEmail(ctx.req);
  const [userProfile, creditBalance, creditLastTopup] = email
    ? await Promise.all([
      getUserProfile(email),
      getUserCredits(email),
      getUserLastTopup(email),
    ])
    : [null, null, null];

  ctx.state.title = "Persuasion";
  ctx.state.userEmail = email;
  ctx.state.isAdmin = email ? isAdminEmail(email) : false;
  ctx.state.userProfile = userProfile;
  ctx.state.requiresProfileCompletion = Boolean(email && !userProfile);
  ctx.state.creditBalance = creditBalance;
  ctx.state.creditLastTopup = creditLastTopup;
  ctx.state.currentPath = new URL(ctx.req.url).pathname;

  return await ctx.next();
}));

app.fsRoutes();
