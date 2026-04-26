---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with a strong visual point of view. Use when Codex needs to design or implement web pages, components, app shells, landing pages, dashboards, or interactive UI where visual quality matters and the result should avoid generic AI aesthetics.
---

# Frontend Design

Build frontend code that feels intentionally designed, not auto-generated. Commit to a specific aesthetic, make it coherent across typography, layout, colour, motion, and detail, and ship working code that matches the product context.

## Workflow

### 1. Choose a sharp direction before coding

Understand the product context and lock in a clear creative direction before touching implementation.

- Define the purpose: who uses the interface, what they need to do, and what feeling the product should create.
- Pick an aesthetic direction with edges. Examples: brutal minimalism, editorial luxury, playful toy-like, industrial utility, retro-futurist, organic natural, art deco geometry, or dense maximalism.
- Name the differentiator: the one visual or interaction idea someone should remember after seeing it.
- Match complexity to intent. A restrained design needs precision and spacing discipline. A maximalist design needs enough structure and implementation detail to avoid becoming a mess.

### 2. Build real UI, not a mood board

Implement production-grade code in the stack the user already has. Preserve existing design systems when working inside an established product; otherwise, create a fresh and opinionated visual system.

- Respect framework and repo conventions.
- Make the UI functional, accessible, and responsive on desktop and mobile.
- Prefer complete, runnable UI over hand-wavy placeholder styling.
- Use comments sparingly and only where the design logic would otherwise be hard to parse.

### 3. Apply aesthetic discipline

Focus on these areas:

- Typography: choose type with character. Avoid generic defaults like Inter, Roboto, Arial, and broad system stacks unless the existing product already depends on them. Pair display and body styles deliberately.
- Colour: define a small palette with CSS variables or equivalent tokens. Use dominant tones and purposeful accents instead of timid evenly-balanced colours.
- Composition: break out of safe component-grid defaults when the concept calls for it. Use asymmetry, overlap, framing, negative space, rhythm, and scale shifts intentionally.
- Motion: add a few meaningful animation beats instead of spraying micro-interactions everywhere. Prioritise page-load sequencing, hover/focus states, and transitions that support the concept.
- Background and texture: create atmosphere with gradients, meshes, grain, patterns, borders, depth, and layered surfaces when appropriate.
- Detailing: ensure icons, shadows, radii, borders, spacing, and copy tone all support the same aesthetic.

### 4. Avoid generic AI slop

Do not converge on the same safe choices every time.

- Do not default to purple gradients on white backgrounds.
- Do not reuse the same trendy font combos across unrelated tasks.
- Do not produce interchangeable SaaS blocks with identical cards, pills, hero copy, and feature grids.
- Do not add ornamental effects that do not support the concept.
- Do not choose minimalism as an excuse for blandness.

### 5. Calibrate to context

Adjust the design to the job:

- For a marketing page, push art direction, hierarchy, and emotion.
- For a dashboard or data-heavy tool, keep the visual system bold but preserve legibility and task flow.
- For an existing app or design system, preserve established patterns and layer in tasteful improvements instead of reinventing everything.
- For minimal interfaces, spend the effort on proportion, spacing, typography, and restraint.
- For expressive interfaces, support the ambition with enough layout and animation code that the result feels finished.

## Output expectations

When responding to a frontend task with this skill:

- State the chosen aesthetic direction in a sentence or two if the intent is not already obvious from the repo.
- Implement the UI directly instead of only describing it.
- Keep the result cohesive from first paint to interaction details.
- Leave the codebase in a runnable state and verify what you can.
