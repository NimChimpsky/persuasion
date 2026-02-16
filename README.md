# Persuasion (Fresh + Deno KV)

Character-driven choose-your-adventure platform with:

- Magic-link email login (indefinite cookie session)
- Required user profile (name + gender) after first login
- User home with active games
- Admin studio for creating games, characters, and plot points
- Guided assistant + plot milestone authoring (no raw JSON action input)
- Friendly game URLs with prefix `/game/:slug`
- Two-pane game board with character roster + selected-character chat
- Deno KV persistence for games, sessions, login tokens, and user progress

## Stack

- [Fresh](https://fresh.deno.dev/)
- Deno Deploy compatible APIs
- Deno KV for storage
- Optional OpenAI-compatible API for live character generation
- Optional Resend API for email delivery

## Run locally

```bash
deno task dev
```

## Environment variables

```bash
# Required for admin access. CSV list.
ADMIN_EMAILS=admin@example.com,another-admin@example.com
APP_BASE_URL=https://persuasion.technology

# Email sending (Resend). Required for magic-link sign-in.
# If missing, magic-link sign-in is disabled.
RESEND_API_KEY=
EMAIL_FROM=gamesmaster@persuasion.technology

MAGIC_LINK_SECRET=2Qv9hJr6Kx1mNp4Tz8bCd3Fw7Ls5Ye0Au2Hi9Mn6Rx4VqPk1

# Optional: default email used by localhost-only dev login.
# Local dev login exists only when RESEND_API_KEY is missing.
LOCAL_DEV_AUTH_EMAIL=dev@local.test

# Startup game reset toggle (early dev). Default is true if omitted.
RESET_GAME_STATE_ON_STARTUP=true

# LLM providers (OpenAI-compatible API format).
# Active provider is selected by admins at runtime in /admin and stored in KV.

# DeepSeek
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat

# OpenAI
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

# Mistral (default provider)
MISTRAL_BASE_URL=https://api.mistral.ai/v1
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest
```

## Data model (KV)

- `games_by_slug/<slug>`: full game config
  - includes `assistant` and `plotMilestones`
- `games_index/<slug>`: list/home metadata
- `user_progress_meta/<email>/<slug>`: chunked transcript metadata
  (codec/version/chunk counts + updated timestamp + user game snapshot)
- `user_progress_chunk/<email>/<slug>/<chunkIndex>`: gzip-compressed transcript
  chunks (JSONL events)
- `user_progress/<email>/<slug>`: legacy format (ignored by reads, still wiped
  by startup reset for cleanup)
- `user_profile/<email>`: player profile (`name`, `gender`, timestamps)
- `magic_tokens/<nonce>`: one-time magic login nonce (token carries HMAC
  signature)
- `sessions/<sessionId>`: login session record
- `app_settings/llm_provider`: active LLM provider (`deepseek`, `openai`, or
  `mistral`)

## Temporary startup reset mode (early dev)

The app currently runs a **destructive game-data reset** at startup via:

- `/Users/sbatty/Dev/cognition/main.ts`
- `/Users/sbatty/Dev/cognition/lib/startup_reset.ts`

Behavior:

- Controlled by `RESET_GAME_STATE_ON_STARTUP` (defaults to `true` in code).
- When `RESET_GAME_STATE_ON_STARTUP=true`:
  - Wipes KV prefixes:
    - `games_by_slug`
    - `games_index`
    - `user_progress`
    - `user_progress_meta`
    - `user_progress_chunk`
  - Reseeds exactly one game from:
    - `/Users/sbatty/Dev/cognition/murder-at-the-olive-farm.v2.txt`
- When `RESET_GAME_STATE_ON_STARTUP=false`:
  - No wipe is performed.
  - Olive farm is still upserted at startup (seed-only mode).
- Preserves:
  - `user_profile`
  - `sessions`
  - `sessions_by_user`
  - `magic_tokens`
  - `app_settings`

Execution frequency:

- If `RESET_GAME_STATE_ON_STARTUP=true` and `DENO_DEPLOYMENT_ID` exists: runs
  once per deployment (marker key:
  `startup_reset/olive_farm_seed_v1/<deploymentId>`)
- If `RESET_GAME_STATE_ON_STARTUP=true` and `DENO_DEPLOYMENT_ID` is missing
  (local): runs on every startup
- If `RESET_GAME_STATE_ON_STARTUP=false`: runs seed-only upsert on every startup

### How to remove later

1. Remove `await resetAndSeedOliveFarmOnStartup();` from
   `/Users/sbatty/Dev/cognition/main.ts`.
2. Remove the import of `resetAndSeedOliveFarmOnStartup` from
   `/Users/sbatty/Dev/cognition/main.ts`.
3. Delete `/Users/sbatty/Dev/cognition/lib/startup_reset.ts`.
4. (Optional) Delete or keep
   `/Users/sbatty/Dev/cognition/lib/local_seed_game.ts` depending on whether you
   still want manual seeding utilities.

## Notes

- User progress is stored as chunked, gzip-compressed transcript JSONL in KV.
- Game snapshots include assistant id, plot milestones, and progression state
  (`turn`, discovered milestones, latest hint).
- First authenticated access requires profile completion at `/profile` before
  other pages or APIs.
- Player profile name and gender are injected into character prompt context.
- Game chat targets the currently selected character from the roster.
- The assistant is pinned at the top of the roster and gives subtle guidance.
- Character-specific secrets/prize logic should be written directly in each
  character system prompt.
- The UI styling imports the same `xllm` visual language (background/font/button
  system) across landing/admin/home/game pages.
- Dev bypass login is only enabled on localhost (`localhost`, `127.0.0.1`,
  `::1`).
- Missing `RESEND_API_KEY` disables magic-link login and enables local dev login
  on localhost.
- Deno KV is mandatory for this app; there is no non-persistent fallback.
- Mistral is the default LLM provider until an admin switches it in `/admin`.
- Local seed now loads
  `/Users/sbatty/Dev/cognition/murder-at-the-olive-farm.v2.txt`, which includes
  guided assistant/milestone sections for local testing.
