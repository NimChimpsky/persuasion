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
APP_BASE_URL=https://persuasion.technology

# Email sending (Resend). Required for magic-link sign-in.
# If missing, magic-link sign-in is disabled.
RESEND_API_KEY=
EMAIL_FROM=gamesmaster@persuasion.technology

MAGIC_LINK_SECRET=2Qv9hJr6Kx1mNp4Tz8bCd3Fw7Ls5Ye0Au2Hi9Mn6Rx4VqPk1

# Optional: default email used by localhost-only dev login.
# Local dev login exists only when RESEND_API_KEY is missing.
LOCAL_DEV_AUTH_EMAIL=dev@local.test

# LLM providers (OpenAI-compatible API format).
# Active provider is selected by admins at runtime in /admin and stored in KV.

# DeepSeek (default provider)
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat

# OpenAI
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## Data model (KV)

- `games_by_slug/<slug>`: full game story config
- `games_index/<slug>`: list/home metadata
- `user_progress/<email>/<slug>`: transcript text + updated timestamp
- `magic_tokens/<nonce>`: one-time magic login nonce (token carries HMAC
  signature)
- `sessions/<sessionId>`: login session record
- `app_settings/llm_provider`: active LLM provider (`deepseek` or `openai`)

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
- Missing `RESEND_API_KEY` disables magic-link login and enables local dev login
  on localhost.
- Deno KV is mandatory for this app; there is no non-persistent fallback.
- DeepSeek is the default LLM provider until an admin switches it in `/admin`.
