import { page } from "fresh";
import { canUseLocalDevAuth } from "../lib/dev_auth.ts";
import { env } from "../lib/env.ts";
import { define } from "../utils.ts";

interface LandingData {
  sent: boolean;
  error: string;
  previewLink: string;
  localDevLink: string;
}

export const handler = define.handlers<LandingData>({
  GET(ctx) {
    if (ctx.state.userEmail) {
      return Response.redirect(new URL("/home", ctx.req.url), 302);
    }

    const url = new URL(ctx.req.url);
    const sent = url.searchParams.get("sent") === "1";
    const error = url.searchParams.get("error") ?? "";
    const previewLink = url.searchParams.get("preview") ?? "";
    const localDevLink = canUseLocalDevAuth(url)
      ? `/auth/dev-login?secret=${
        encodeURIComponent(env.localDevAuthSecret)
      }&email=${encodeURIComponent(env.localDevAuthEmail)}`
      : "";

    return page({ sent, error, previewLink, localDevLink });
  },
});

export default define.page<typeof handler>(
  function LandingPage({ data, state }) {
    state.title = "Story Realms | Sign in";

    return (
      <main class="hero page-shell">
        <div class="container stack" style="max-width: 760px;">
          <section class="card form-card stack">
            <h1>Sign in to enter story worlds</h1>
            <p class="muted">
              Enter your email and we will send a magic login link. Once
              clicked, you stay signed in.
            </p>
            {data.sent
              ? (
                <p class="notice good">
                  Login link sent. Check your inbox and click the sign-in link.
                </p>
              )
              : null}
            {data.error ? <p class="notice bad">{data.error}</p> : null}
            <form method="POST" action="/auth/request-link" class="form-grid">
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  required
                  autocomplete="email"
                  placeholder="you@example.com"
                />
              </label>
              <div class="action-row">
                <button class="btn primary" type="submit">
                  Send sign-in link
                </button>
              </div>
            </form>
            {data.previewLink
              ? (
                <p class="notice">
                  Dev preview link:
                  <br />
                  <a href={data.previewLink}>{data.previewLink}</a>
                </p>
              )
              : null}
            {data.localDevLink
              ? (
                <p class="notice">
                  Local developer login:
                  <br />
                  <a href={data.localDevLink}>{data.localDevLink}</a>
                </p>
              )
              : null}
          </section>
        </div>
      </main>
    );
  },
);
