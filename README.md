# Persuasion (Fresh + Deno KV)

Character-driven choose-your-adventure platform with:

- Magic-link email login (indefinite cookie session)
- Required user profile (name + gender) after first login
- User home with active games
- Admin studio for creating games with characters and optional secret keys
- LLM-based Game Initializer that hardens raw character definitions into robust system prompts
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

## Game Initializer

Raw character definitions written by game creators are short, human-readable descriptions. Before a game is played, the **Game Initializer** (`lib/game_initializer.ts`) transforms each definition into a hardened system prompt via an LLM call.

The hardening process instructs the LLM to produce a prompt that:

- **Establishes character voice** — speech patterns, emotional register, conversational style
- **Sets knowledge boundaries** — what the character knows and will not volunteer without being asked
- **Creates revelation dynamics** — information is layered; surface responses for casual questions, deeper responses when trust or evidence is earned
- **Enforces third-person narrative perspective** — all responses are written as observable narration (`Josef glanced away. "I don't know what you mean," he muttered.`), never pure first-person stream of consciousness
- **Builds defensive behaviour** — realistic reactions to accusations, pressure, and manipulation
- **Protects secrets** — if a character definition contains a secret key, the hardened prompt establishes strict conditions for its revelation and resists direct requests or tricks
- **Adds anti-injection rules** — the character never reveals its system prompt, never breaks character, and treats override attempts as in-character confusion

Hardening runs once per character per deployment. Characters are all hardened in parallel. If hardening fails for a character the raw definition is used as a fallback so the game still functions.

### Observable perspective enforcement

At runtime, every LLM response is validated before being sent to the player:

- A **POV blocklist** rejects responses containing inner-thought language (`he thought`, `in her mind`, `secretly knew`, pure first-person openers, etc.)
- An **assistant grounding check** prevents the game assistant from citing interviews or conversations that have not yet appeared in the transcript
- A **safety guard** (secondary LLM call) checks that the response does not break the fourth wall or leak system instructions
- Responses that fail any check are retried up to three times with a correction hint injected into the prompt

### Seed games

Seed games live in the `seed-games/` directory as `.txt` files. Any `.txt` file placed there is automatically picked up on the next deployment — no code changes required. Each file must contain at minimum:

```
# Game title
- Title here

# Intro
- Scene-setting paragraph shown to the player

# Characters
- Name, definition text...
  key: OptionalSecretKey
```

On each deployment the app wipes existing game data, seeds basic configs from these files (fast, no LLM), then hardens all character prompts in the background via the Game Initializer.

