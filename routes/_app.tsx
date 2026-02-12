import SiteHeader from "../components/SiteHeader.tsx";
import { define } from "../utils.ts";
import { Partial } from "fresh/runtime";

export default define.page(function App({ Component, state }) {
  const isLoggedIn = Boolean(state.userEmail);

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
      <body f-client-nav>
        <Partial name="app-shell">
          {isLoggedIn && state.userEmail
            ? (
              <div class="header-shell">
                <div class="container">
                  <SiteHeader
                    userEmail={state.userEmail}
                    isAdmin={state.isAdmin}
                  />
                </div>
              </div>
            )
            : null}
          <Component />
        </Partial>
      </body>
    </html>
  );
});
