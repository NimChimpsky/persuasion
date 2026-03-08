import { page } from "fresh";
import LandingLoginForm from "../islands/LandingLoginForm.tsx";
import { canUseLocalDevAuth } from "../lib/dev_auth.ts";
import { env } from "../lib/env.ts";
import { define } from "../utils.ts";

interface LandingData {
  sent: boolean;
  error: string;
  emailSignInEnabled: boolean;
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
    const emailSignInEnabled = Boolean(env.resendApiKey);
    const localDevLink = canUseLocalDevAuth(url) ? "/auth/dev-login" : "";

    return page({ sent, error, emailSignInEnabled, localDevLink });
  },
});

export default define.page<typeof handler>(
  function LandingPage({ data, state }) {
    state.title = "PERSUASION | Sign in";

    return (
      <main class="hero page-shell">
        <div class="container landing-hero stack" style="max-width: 760px;">
          <div class="landing-title">
            <img
              class="landing-title-logo"
              src="/logo/transparent_logo_only.png"
              width="44"
              height="44"
              alt="Persuasion logo"
            />
            <h1>PERSUASION</h1>
          </div>
          <p class="muted">
            An interactive character driven experience of secrets and lies ...
            and actual cash prizes
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
          {data.emailSignInEnabled
            ? <LandingLoginForm action="/auth/request-link" />
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
          {!data.emailSignInEnabled && !data.localDevLink
            ? (
              <p class="notice landing-notice">
                Sign-in is disabled in this environment.
              </p>
            )
            : null}
          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
            <p class="muted" style="margin-bottom: 0.75rem;">Also check out</p>
            <a
              href="https://vibez.persuasion.technology"
              style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #FFE600, #FF6EC7); color: #0D0D1A; font-weight: bold; font-size: 1.1rem; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 0 16px rgba(255,230,0,0.3), 0 0 32px rgba(255,110,199,0.15);"
            >
              vibez — AI-enhanced Kanban boards
            </a>
          </div>
        </div>
      </main>
    );
  },
);
