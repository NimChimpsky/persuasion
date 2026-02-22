# Cognition — Project Context

## What This Is

**Persuasion** is an interactive narrative game engine built with Deno/Fresh + Preact. Players chat with AI-driven NPCs to investigate a mystery and uncover secrets. The LLM powers all character dialogue. A Game Initializer hardens raw character definitions into robust system prompts via an LLM call.

## Tech Stack

- **Runtime**: Deno (Fresh framework, server-side JSX)
- **UI**: Preact with hooks (islands architecture)
- **Persistence**: Deno KV (chunked gzip-compressed JSONL transcripts)
- **LLM**: OpenAI-compatible API (supports DeepSeek, OpenAI, Mistral, Venice — configurable at runtime)
- **Auth**: Magic-link email login with session cookies

## Key Architecture

### File Layout

| Path | Purpose |
|---|---|
| `lib/llm.ts` | LLM calls, system prompt construction, response validation |
| `lib/llm_client.ts` | Shared LLM HTTP utilities (request, endpoint, JSON extraction) |
| `lib/game_engine.ts` | Simple turn counter (buildInitialProgressState, incrementTurn) |
| `lib/game_initializer.ts` | LLM-based prompt hardening for character definitions |
| `lib/store.ts` | KV persistence (games, profiles, chunked progress) |
| `lib/local_seed_game.ts` | Parses game definitions from `.txt` files |
| `lib/startup_reset.ts` | Dev/deploy startup: wipe + reseed + initialize game data |
| `lib/llm_provider.ts` | LLM provider config and switching |
| `lib/auth.ts` | Magic-link login, session management |
| `shared/types.ts` | Core data models (Character, GameConfig, ProgressState, etc.) |
| `shared/transcript.ts` | JSONL transcript parsing and formatting |
| `routes/api/games/[slug]/message.ts` | Main game message API (SSE streaming) |
| `routes/game/[slug].tsx` | Game page handler + render |
| `routes/create-game.tsx` | Game creation form + initializer integration |
| `islands/GameBoard.tsx` | Interactive chat UI and client-side state |
| `islands/AdminGameForm.tsx` | Game creation form (characters with definitions + optional secret keys) |
| `seed-games/murder-at-the-olive-farm.v2.txt` | Seed game definition |
| `seed-games/a-nice-glass-of-chianti.txt` | Seed game definition |

### Message Flow

1. Player sends message to a character via `POST /api/games/:slug/message`
2. System prompt built from character's hardened `systemPrompt` + player profile + security rules
3. LLM generates in-character response (validated for POV rules + assistant grounding + output safety)
4. Response parsed for `<game_update>` directives (dynamic character creation/unlocking)
5. Turn counter incremented
6. Everything saved to KV; SSE events streamed back to client (`ack` → `delta` → `final`)

### Game Initializer Flow

1. Game created with raw character `definition` text and `systemPrompt: ""`
2. `initializeGame()` sends each character definition to LLM with a hardening prompt
3. LLM produces a hardened system prompt with: character voice, knowledge boundaries, revelation dynamics, defensive behavior, anti-injection rules
4. Characters updated with populated `systemPrompt` fields, game marked `initialized: true`

### Core Data Models

- **GameConfig**: slug, title, introText, isAdult, initialized, characters[], active — no assistant field; assistant is system-wide
- **Character**: id (kebab-case slug), name, bio (auto-derived, max 140 chars), definition (raw text), systemPrompt (hardened by initializer), secretKey? (optional)
- **ProgressState**: turn count only (`{ turn: number }`)
- **UserGameSnapshot**: per-user copy of game state (characters can diverge via dynamic additions), encounteredCharacterIds[], progressState — no assistantId (always global)
- **TranscriptEvent**: role (user|character), characterId, characterName, text, timestamp

### Game Definition Format (`.txt`)

```
# Game title
- murder at the olive farm

# Intro
- A body is found at an olive farm...

# Uncensored
- yes (optional, enables adult content routing)

# Characters
- Character Name, definition text describing who they are, what they know, how they behave...
  key: optional-secret-key-value

# User
- Player character description (folded into character definitions as context)
```

The assistant is not defined in game files — it is a single system-wide config managed via `/admin`.

### Validation Systems

- **POV blocklist**: Regex patterns block omniscient narration (internal thoughts, "unbeknownst to you", etc.)
- **Assistant grounding**: Assistant can only reference characters that appear in the transcript; cannot claim interviews that haven't happened
- **Output safety**: Blocks meta-awareness patterns (AI acknowledgment, system prompt references) and suspicious base64 strings
- **LLM guard**: Secondary LLM call validates responses don't break fourth wall
- **Input reinforcement**: Detects prompt injection attempts and adds security alerts to system prompt

## Current State: What Works Well

- Chat with multiple AI characters (streaming SSE)
- Game Initializer hardens raw definitions into robust system prompts
- Assistant grounding (only references actual transcript content)
- Observable-perspective enforcement on all responses
- Secret key protection via hardened prompts (no milestone gating)
- User profile capture (name, gender) injected into all prompts
- Chunked transcript storage (handles large conversations within KV limits)
- Game reset/reseed + initialization on startup (controlled by `RESET_GAME_STATE_ON_STARTUP` env var)
- Dynamic character creation via `<game_update>` directives in LLM responses
- GUI game creation with automatic prompt hardening
