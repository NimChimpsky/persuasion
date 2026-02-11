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
    state.title = "PERSUASION | Sign in";

    return (
      <main class="hero page-shell">
        <div class="container landing-hero stack" style="max-width: 760px;">
          <h1>PERSUASION</h1>
          <p class="muted">
            A narrative game experience of secrets and lies ... and crypto
            prizes
          </p>
          {data.sent
            ? (
              <p class="notice landing-notice good">
                Login link sent. Check your inbox and click the sign-in link.
              </p>
            )
            : null}
          {data.error
            ? <p class="notice landing-notice bad">{data.error}</p>
            : null}
          <form
            method="POST"
            action="/auth/request-link"
            class="form-grid landing-login-form"
          >
            <input
              type="email"
              name="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <div class="action-row center">
              <button class="btn ghost landing-cta-btn" type="submit">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                Send sign-in link
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </button>
            </div>
          </form>
          {data.previewLink
            ? (
              <p class="notice landing-notice">
                Dev preview link:
                <br />
                <a href={data.previewLink}>{data.previewLink}</a>
              </p>
            )
            : null}
          {data.localDevLink
            ? (
              <p class="notice landing-notice">
                Local developer login:
                <br />
                <a href={data.localDevLink}>{data.localDevLink}</a>
              </p>
            )
            : null}
        </div>
      </main>
    );
  },
);
