import { define } from "../utils.ts";

export default define.page(function App({ Component, state }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{state.title ?? "Persuasion"}</title>
        <link rel="stylesheet" href="/fonts.css" />
        <link rel="stylesheet" href="/fonts-local.css" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/theme-light.css" />
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
