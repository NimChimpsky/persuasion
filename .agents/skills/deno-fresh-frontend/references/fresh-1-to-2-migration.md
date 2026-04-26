# Fresh 1.x to 2.x Migration

## Contents

- Fast repo triage
- Replace stale imports and files
- Update handlers and errors
- Fix tasks and build flow
- Re-test the app

## Fast repo triage

Run targeted searches before editing:

```bash
rg -n '\$fresh/server\.ts|\$fresh/runtime\.ts|fresh\.gen\.ts|fresh\.config\.ts|dev\.ts|renderNotFound' .
rg -n '\b(GET|POST|PUT|PATCH|DELETE)\s*\(\s*req\s*,\s*ctx|\bhandler\b.*\(\s*req\s*,\s*ctx' routes
```

Treat hits as migration work, not normal feature work.

## Replace stale imports and files

Remove or rewrite these 1.x patterns:

- `import { Handlers, PageProps } from "$fresh/server.ts"`
- `import { Head } from "$fresh/runtime.ts"`
- `import manifest from "./fresh.gen.ts"`
- `dev.ts`
- `fresh.config.ts`
- split error pages that should now be handled by `_error.tsx`

Prefer these 2.x-era imports instead:

```ts
import { App, fsRoutes, staticFiles } from "fresh";
import type { PageProps } from "fresh";
import { IS_BROWSER } from "fresh/runtime";
```

If the project relies on typed route helpers or shared state, add a local `createDefine` helper and migrate routes onto it instead of scattering ad hoc types.

## Update handlers and errors

Replace two-argument handlers with single-context handlers:

```ts
// old
GET(req, ctx) {
  return ctx.render();
}

// new
GET(ctx) {
  return ctx.render();
}
```

Replace stale error helpers with explicit redirects, responses, or `HttpError`.

Audit middleware for old assumptions about `ctx` shape or deprecated properties.

## Fix tasks and build flow

Remove old task commands like these:

```json
{
  "tasks": {
    "dev": "deno run -A dev.ts",
    "build": "deno run -A dev.ts build",
    "preview": "deno run -A main.ts"
  }
}
```

Move to the Vite-based flow:

```json
{
  "tasks": {
    "dev": "vite",
    "build": "vite build",
    "preview": "deno serve -A _fresh/server.js"
  }
}
```

Confirm `main.ts`, `client.ts`, and `vite.config.ts` exist and match the current project structure.

## Re-test the app

After migration:

1. Run `deno task build`.
2. Run `deno test`.
3. Start `deno task dev` and click through the changed routes.
4. Verify islands still hydrate and API routes still return the expected payloads.

If the repo still mixes 1.x and 2.x patterns after the first pass, call that out plainly. Half-migrated Fresh apps are where the nasty bugs hide.
