---
name: deno-fresh-frontend
description: Build and maintain Deno Fresh 2.x frontends with Preact, islands, middleware, route handlers, createDefine helpers, and Vite or Tailwind tooling. Use when creating a new Fresh app, adding or refactoring server-rendered routes or API endpoints, building interactive islands, wiring styling, or migrating stale Fresh 1.x code that still uses $fresh imports, fresh.gen.ts, dev.ts, fresh.config.ts, or two-argument handlers.
---

# Deno Fresh Frontend

## Overview

Build Fresh 2.x apps with an SSR-first mindset. Prefer server-rendered routes and plain components by default, then add islands only where browser-side interactivity is actually needed.

Treat the biggest failure mode as outdated Fresh 1.x advice. Fresh 2.x is Vite-based, uses a single handler context parameter, and no longer uses `fresh.gen.ts`, `dev.ts`, or `$fresh/*` imports.

## Run This Workflow

1. Identify whether the request is new app work, normal Fresh 2.x feature work, or Fresh 1.x migration work.
2. Inspect `deno.json`, `main.ts`, `client.ts`, `vite.config.ts`, `routes/`, `islands/`, and `components/` before making assumptions.
3. Search aggressively for stale patterns before editing:
   - `$fresh/server.ts`
   - `$fresh/runtime.ts`
   - `fresh.gen.ts`
   - `fresh.config.ts`
   - `dev.ts`
   - `renderNotFound`
   - two-argument handlers like `(req, ctx)`
4. Keep route files and server components lean. Move interactivity into small islands instead of shipping whole pages to the browser.
5. Prefer typed helpers and request-scoped state when handlers, middleware, and pages share data.
6. Verify with the smallest relevant command set, usually `deno task build`, `deno test`, or both.

## Apply These Rules

- Use Fresh 2.x stable patterns only.
- Prefer `deno run -Ar jsr:@fresh/init` for brand new apps instead of hand-rolling scaffolding.
- Prefer server components in `routes/` and `components/`.
- Use `islands/` only for UI that needs clicks, form state, effects, timers, or browser APIs.
- Keep island props serializable. Do not pass functions into islands.
- Prefer `@preact/signals` for simple reactive state; reach for hooks when lifecycle, refs, or external subscriptions matter.
- Add packages with `deno add` so `deno.json` stays accurate.
- Keep examples, imports, and commands aligned with the current Vite-based Fresh stack.

## Choose The Right Pattern

### New app or major rebuild

Inspect the current repo first. If there is no usable Fresh app yet, scaffold with `jsr:@fresh/init`, keep the stock file layout, and only customise after the app boots cleanly.

### Standard page or API work

Prefer server-rendered routes, async page components, typed handlers, and middleware-populated `ctx.state`. Read [references/fresh-2-patterns.md](references/fresh-2-patterns.md) for canonical snippets.

### Interactive UI work

Keep the page itself server-rendered and hydrate only the interactive fragment as an island. Pass plain serializable props down from the route.

### Migration or bugfix work

Assume old examples are suspect until proven otherwise. Read [references/fresh-1-to-2-migration.md](references/fresh-1-to-2-migration.md) and remove stale imports, files, handler signatures, and task commands before doing anything fancy.

## Reach For References

- Read [references/fresh-2-patterns.md](references/fresh-2-patterns.md) when you need working Fresh 2.x structure, routing, middleware, island, styling, or testing patterns.
- Read [references/fresh-1-to-2-migration.md](references/fresh-1-to-2-migration.md) when the repo contains old Fresh 1.x syntax or the request mentions migration, upgrades, or weird handler imports.

## Finish Cleanly

- Run `deno task build` after structural or routing changes.
- Run `deno test` when handlers, middleware, or islands change and tests exist or should exist.
- Call out any unresolved version mismatch, missing Deno tasks, or legacy code you intentionally left alone.
