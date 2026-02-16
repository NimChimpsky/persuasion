import { page } from "fresh";
import { upsertUserProfile } from "../lib/store.ts";
import type { UserGender } from "../shared/types.ts";
import { define } from "../utils.ts";

interface ProfileData {
  name: string;
  gender: UserGender;
  next: string;
  error: string;
}

function sanitizeNextPath(input: string | null): string {
  const value = String(input ?? "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/home";
  }

  try {
    const parsed = new URL(value, "https://persuasion.technology");
    if (parsed.origin !== "https://persuasion.technology") {
      return "/home";
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/home";
  }
}

function normalizeGender(input: string): UserGender {
  const value = input.trim().toLowerCase();
  if (value === "male" || value === "female" || value === "non-binary") {
    return value;
  }
  return "male";
}

function createData(
  name: string,
  gender: string,
  next: string,
  error: string,
): ProfileData {
  return {
    name,
    gender: normalizeGender(gender),
    next: sanitizeNextPath(next),
    error,
  };
}

export const handler = define.handlers<ProfileData>({
  GET(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const url = new URL(ctx.req.url);
    const next = sanitizeNextPath(url.searchParams.get("next"));
    const profile = ctx.state.userProfile;

    return page(
      createData(
        profile?.name ?? "",
        profile?.gender ?? "male",
        next,
        "",
      ),
    );
  },

  async POST(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return Response.redirect(new URL("/", ctx.req.url), 302);
    }

    const form = await ctx.req.formData();
    const name = String(form.get("name") ?? "").trim();
    const gender = String(form.get("gender") ?? "");
    const next = sanitizeNextPath(String(form.get("next") ?? "/home"));

    try {
      await upsertUserProfile(email, {
        name,
        gender,
      });
    } catch (error) {
      const message = error instanceof Error && error.message ===
          "invalid_profile_name"
        ? "Enter a name between 1 and 60 characters."
        : error instanceof Error && error.message === "invalid_profile_gender"
        ? "Select a valid gender."
        : "Unable to save profile.";
      return page(createData(name, gender, next, message), { status: 400 });
    }

    return Response.redirect(new URL(next, ctx.req.url), 303);
  },
});

export default define.page<typeof handler>(
  function ProfilePage({ data, state }) {
    if (!state.userEmail) return null;

    const isExistingProfile = Boolean(state.userProfile);
    state.title = "Persuasion | Profile";

    return (
      <main class="page-shell">
        <div class="container stack">
          <section class="stack">
            <h2 class="display">Profile</h2>
            <p class="muted">
              {isExistingProfile
                ? "Update your profile details."
                : "Complete your profile before continuing."}
            </p>
          </section>
          <form
            method="POST"
            action="/profile"
            class="form-grid card form-card"
          >
            <input type="hidden" name="next" value={data.next} />
            <label>
              Name
              <input
                type="text"
                name="name"
                value={data.name}
                required
                maxLength={60}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
            <label>
              Gender
              <select name="gender" value={data.gender} required>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="non-binary">non-binary</option>
              </select>
            </label>
            {data.error ? <p class="notice bad">{data.error}</p> : null}
            <div class="action-row">
              <button class="btn primary" type="submit">Save profile</button>
            </div>
          </form>
        </div>
      </main>
    );
  },
);
