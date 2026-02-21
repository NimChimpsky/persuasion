# Cognition — Project Context

## What This Is

**Persuasion** is an interactive detective narrative game engine built with Deno/Fresh + Preact. Players chat with AI-driven NPCs to investigate a mystery, uncover clues, and progress through plot milestones. The LLM powers all character dialogue and a semantic judge evaluates story progression.

## Tech Stack

- **Runtime**: Deno (Fresh framework, server-side JSX)
- **UI**: Preact with hooks (islands architecture)
- **Persistence**: Deno KV (chunked gzip-compressed JSONL transcripts)
- **LLM**: OpenAI-compatible API (supports DeepSeek, OpenAI, Mistral — configurable at runtime)
- **Auth**: Magic-link email login with session cookies

## Key Architecture

### File Layout

| Path | Purpose |
|---|---|
| `lib/llm.ts` | LLM calls, system prompt construction, response validation, milestone judge |
| `lib/game_engine.ts` | Milestone progression logic (apply, sanitize, compute undiscovered) |
| `lib/store.ts` | KV persistence (games, profiles, chunked progress) |
| `lib/local_seed_game.ts` | Parses game definitions from `.txt` files |
| `lib/startup_reset.ts` | Dev/deploy startup: wipe + reseed game data |
| `lib/llm_provider.ts` | LLM provider config and switching |
| `lib/auth.ts` | Magic-link login, session management |
| `shared/types.ts` | Core data models (Character, GameConfig, PlotMilestone, etc.) |
| `shared/transcript.ts` | JSONL transcript parsing and formatting |
| `routes/api/games/[slug]/message.ts` | Main game message API (SSE streaming) |
| `routes/game/[slug].tsx` | Game page handler + render |
| `islands/GameBoard.tsx` | Interactive chat UI and client-side state |
| `seed-games/murder-at-the-olive-farm.v2.txt` | Current test game definition |

### Message Flow

1. Player sends message to a character via `POST /api/games/:slug/message`
2. System prompt built from character definition + player profile + plot context
3. LLM generates in-character response (validated for POV rules + assistant grounding)
4. Response parsed for `<game_update>` directives (dynamic character creation/unlocking)
5. Milestone semantic judge evaluates if any milestones were newly achieved
6. Progress state updated (turn counter + discovered milestone IDs)
7. Everything saved to KV; SSE events streamed back to client (`ack` → `delta` → `final`)

### Core Data Models

- **GameConfig**: slug, title, intro, plotPointsText, assistant, plotMilestones[], characters[], active
- **Character**: id (kebab-case slug), name, bio (first sentence of prompt, max 140 chars), systemPrompt
- **PlotMilestone**: id, title, description
- **ProgressState**: turn count + discoveredMilestoneIds[]
- **UserGameSnapshot**: per-user copy of game state (characters can diverge from original via dynamic additions), encounteredCharacterIds[], progressState
- **TranscriptEvent**: role (user|character), characterId, characterName, text, timestamp

### Game Definition Format (`.txt`)

```
# Game title
- murder at the olive farm

# Intro
- A body is found at an olive farm...

# Plot points
- (global plot facts injected into all non-assistant character prompts)

# Secret
- (conditions and prize key, embedded in character prompts)

# Assistant
- Name: Assistant
- Bio: ...
- System prompt: ...

# Plot milestones
- milestone-title | description of what triggers it

# Characters
- Character Name, system prompt text...

# User
- Player character description (not interactive)
```

### Validation Systems

- **POV blocklist**: Regex patterns block omniscient narration (internal thoughts, "unbeknownst to you", etc.)
- **Assistant grounding**: Assistant can only reference characters that appear in the transcript; cannot claim interviews that haven't happened
- **Milestone sanitization**: Prevents discovering already-discovered or unknown milestone IDs

## Current State: What Works Well

- Chat with multiple AI characters (streaming SSE)
- Assistant grounding (only references actual transcript content)
- Observable-perspective enforcement on all responses
- Milestone semantic judging (LLM evaluates progression after each turn)
- User profile capture (name, gender) injected into all prompts
- Chunked transcript storage (handles large conversations within KV limits)
- Game reset/reseed on startup (controlled by `RESET_GAME_STATE_ON_STARTUP` env var)
- Dynamic character creation via `<game_update>` directives in LLM responses

## Open Design Problem: Story Progression & Character Revelation

The game engine needs significant refinement in how the story progresses and how characters are revealed/gated. The following issues are identified:

### Gap 1: Characters Are All Visible From the Start
All characters appear in the sidebar immediately. `encounteredCharacterIds` tracks who the player has *talked to*, but every character is clickable from turn one. There is no concept of hidden/locked characters. This removes discovery tension.

### Gap 2: Milestones Are Passive Counters
Milestones are tracked and displayed (`Milestones 2/5`) but don't drive anything. They don't unlock characters, gate conversations, change character behavior, trigger events, or have prerequisites. "Name killer" could theoretically be achieved before "Identify body."

### Gap 3: Character Unlocking Is Ad-Hoc
The `<game_update>` directive lets LLM characters spontaneously create/unlock characters. This is unstructured and unreliable — the LLM might never emit it or emit it at the wrong time.

### Gap 4: Assistant Lacks Structured Guidance
The assistant has no awareness of undiscovered milestones. It can't subtly guide the player toward productive investigation steps beyond what's observable in the transcript.

### Gap 5: No Narrative Gating
No chapters, phases, or prerequisite chains. The story is flat — players could stumble into endgame secrets immediately.

### Design Decisions Needed

1. **Character visibility**: Should characters start hidden and unlock via milestones? Or be visible but refuse to talk until conditions are met?
2. **Milestone prerequisites**: Should milestones have dependency chains (e.g., "Confirm DNA match" requires "Obtain blood evidence")?
3. **Milestone-driven unlocks**: Should milestones automatically unlock characters, reveal plot points, or inject narrative events?
4. **Character behavior evolution**: Should character prompts change based on which milestones are discovered (e.g., Giannis becomes more defensive)?
5. **Assistant intelligence**: Should the assistant see undiscovered milestones and subtly nudge toward them?
6. **Game definition format**: How to encode these relationships in the `.txt` game file (character unlock conditions, milestone prereqs, per-milestone behavior)?
7. **Authored vs. emergent**: Balance between structured game-designer control and dynamic LLM-driven progression.

### Guiding Principle

The core tension is **authored control** (game designer defines exactly when characters unlock and what triggers what) vs. **emergent LLM-driven** progression (LLM decides dynamically). The current system leans entirely on the emergent side, which makes progression feel uncontrolled. The solution likely involves a structured layer (milestone prereqs, character unlock rules) with the LLM handling the narrative texture on top.
