# Persuasion (Fresh + Deno KV)

Character-driven choose-your-adventure platform with:

- Magic-link email login (indefinite cookie session)
- User home with active games
- Admin studio for creating games, characters, plot points, and a narrator
  prompt
- Friendly game URLs with prefix `/game/:slug`
- 9-pane game board with narrator-first chat and optional `@character` routing
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

# Optional email sending (Resend). If missing, localhost uses local dev mode.
RESEND_API_KEY=
EMAIL_FROM=gamesmaster@persuasion.technology

# Optional: if true and email delivery is not configured, login page shows dev preview link.
MAGIC_LINK_PREVIEW=true
MAGIC_LINK_SECRET=2Qv9hJr6Kx1mNp4Tz8bCd3Fw7Ls5Ye0Au2Hi9Mn6Rx4VqPk1

# Optional: localhost-only dev bypass login secret.
# If RESEND_API_KEY is missing, local mode is enabled automatically on localhost
# and this secret is not required.
LOCAL_DEV_AUTH_SECRET=replace-with-long-random-secret
LOCAL_DEV_AUTH_EMAIL=dev@local.test

# Optional: enable AI character responses (OpenAI-compatible providers)
# Examples:
# - OpenAI: LLM_BASE_URL=https://api.openai.com/v1
# - OpenRouter: LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4.1-mini
```

## Data model (KV)

- `games_by_slug/<slug>`: full game story config
- `games_index/<slug>`: list/home metadata
- `user_progress/<email>/<slug>`: transcript text + updated timestamp
- `magic_tokens/<nonce>`: one-time magic login nonce (token carries HMAC
  signature)
- `sessions/<sessionId>`: login session record

## Notes

- User progress is stored as full transcript text (JSON lines).
- Game chat defaults to the narrator when no `@character_id` mention is present.
- Character-specific secrets/prize logic should be written directly in each
  character system prompt.
- Narrator behavior is configurable per game in admin via
  `Narrator system prompt`.
- The UI styling imports the same `xllm` visual language (background/font/button
  system) across landing/admin/home/game pages.
- Dev bypass login is only enabled on localhost (`localhost`, `127.0.0.1`,
  `::1`).
- Missing `RESEND_API_KEY` automatically enables local dev mode on localhost.
- Deno KV is mandatory for this app; there is no non-persistent fallback.
