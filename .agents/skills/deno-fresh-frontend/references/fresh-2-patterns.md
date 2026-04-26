# Fresh 2.x Patterns

## Contents

- Project shape
- Bootstrap and config
- Typed state and handlers
- Islands and Preact
- Styling, commands, and tests

## Project shape

Treat this as the normal Fresh 2.x layout:

```text
my-app/
├── deno.json
├── main.ts
├── client.ts
├── vite.config.ts
├── routes/
├── islands/
├── components/
├── static/
└── utils/
```

Expect `routes/` to own file-based routing, `components/` to stay server-only, and `islands/` to hold hydrated interactive pieces.

## Bootstrap and config

Create new projects with:

```bash
deno run -Ar jsr:@fresh/init
```

Use a Vite-based config. The exact plugin list varies by project, but it should look broadly like this:

```ts
import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [fresh(), tailwindcss()],
});
```

Keep `deno.json` tasks current:

```json
{
  "tasks": {
    "dev": "vite",
    "build": "vite build",
    "preview": "deno serve -A _fresh/server.js"
  }
}
```

Use a modern entry point:

```ts
import { App, fsRoutes, staticFiles, trailingSlashes } from "fresh";

const app = new App()
  .use(staticFiles())
  .use(trailingSlashes("never"));

await fsRoutes(app, {
  dir: "./",
  loadIsland: (path) => import(`./islands/${path}`),
  loadRoute: (path) => import(`./routes/${path}`),
});

if (import.meta.main) {
  await app.listen();
}
```

## Typed state and handlers

Prefer a shared define helper when middleware and routes exchange typed state:

```ts
import { createDefine } from "fresh";

export interface State {
  user?: {
    id: string;
    name: string;
  };
}

export const define = createDefine<State>();
```

Prefer a single context parameter in handlers:

```ts
export const handler = {
  GET(ctx) {
    return new Response(`hello ${ctx.url.pathname}`);
  },
};
```

Use typed handlers and pages when route data matters:

```tsx
import { define } from "@/utils/state.ts";

export const handler = define.handlers((ctx) => {
  if (!ctx.state.user) return ctx.redirect("/login");
  return { data: { user: ctx.state.user } };
});

export default define.page(({ data }) => {
  return <h1>Welcome, {data.user.name}</h1>;
});
```

Use middleware to enrich `ctx.state` or wrap responses:

```ts
import { define } from "@/utils/state.ts";

export const handler = define.middleware(async (ctx) => {
  const session = await getSession(ctx.req);
  if (session) {
    ctx.state.user = session.user;
  }

  const res = await ctx.next();
  res.headers.set("x-app", "fresh");
  return res;
});
```

Throw `HttpError` or return redirects instead of inventing custom old-school error helpers.

## Islands and Preact

Prefer server-rendered pages that pass plain props into small islands:

```tsx
import Counter from "../islands/Counter.tsx";

export default function Home() {
  return <Counter initialCount={0} />;
}
```

Keep islands focused:

```tsx
import { useSignal } from "@preact/signals";

export default function Counter(props: { initialCount: number }) {
  const count = useSignal(props.initialCount);

  return (
    <button onClick={() => count.value++}>
      Count: {count.value}
    </button>
  );
}
```

Use hooks from `preact/hooks` when you need effects or refs. Prefer signals when plain reactive state is enough.

Guard browser-only logic when SSR would choke on it:

```tsx
import { IS_BROWSER } from "fresh/runtime";

if (!IS_BROWSER) {
  return <span>Loading...</span>;
}
```

Do not pass functions into islands. Pass IDs, booleans, strings, numbers, arrays, plain objects, dates, URLs, or other serializable values instead.

## Styling, commands, and tests

Use Tailwind through the Vite plugin when the app includes Tailwind. Prefer utility classes and match the existing codebase convention for `class` versus `className`.

Use these commands as the baseline:

```bash
deno task dev
deno task build
deno task preview
deno test
```

Write small integration-style tests around handlers and middleware when practical. Fresh works well with Deno's built-in test runner, so avoid dragging in unnecessary extra tooling unless the repo already uses it.
