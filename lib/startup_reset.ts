import { env } from "./env.ts";
import { initializeGame } from "./game_initializer.ts";
import { getKv } from "./kv.ts";
import {
  buildAllSeedGameConfigs,
  upsertGameAndIndex,
} from "./local_seed_game.ts";
import {
  getGlobalAssistantConfig,
  setGlobalAssistantConfig,
} from "./store.ts";
import type { AssistantConfig, GameConfig } from "../shared/types.ts";

const DELETE_BATCH_SIZE = 10;

const WIPE_PREFIXES: Deno.KvKey[] = [
  ["games_by_slug"],
  ["games_index"],
  ["user_progress"],
  ["user_progress_meta"],
  ["user_progress_chunk"],
];

const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  id: "assistant",
  name: "Assistant",
  bio: "AI Assistant who can provide tips and guide you through your journey to find the secret, if stuck just ask!",
  systemPrompt:
    "You are the player's investigation assistant. Stay supportive, practical, and grounded in observable evidence. Ask useful follow-up questions, suggest sensible next steps, and avoid spoilers.",
};

interface ResetMarker {
  deploymentId: string;
  gameSlug: string;
  appliedAt: string;
}

async function deleteKeyBatch(kv: Deno.Kv, keys: Deno.KvKey[]): Promise<void> {
  if (keys.length === 0) return;
  let op = kv.atomic();
  for (const key of keys) {
    op = op.delete(key);
  }
  const result = await op.commit();
  if (!result.ok) {
    throw new Error("KV delete batch failed during startup reset");
  }
}

async function wipePrefix(kv: Deno.Kv, prefix: Deno.KvKey): Promise<number> {
  let deleted = 0;
  let batch: Deno.KvKey[] = [];

  for await (const entry of kv.list({ prefix })) {
    batch.push(entry.key);
    if (batch.length >= DELETE_BATCH_SIZE) {
      await deleteKeyBatch(kv, batch);
      deleted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await deleteKeyBatch(kv, batch);
    deleted += batch.length;
  }

  return deleted;
}

function markerKey(deploymentId: string): Deno.KvKey {
  return ["startup_reset", deploymentId];
}

async function ensureGlobalAssistantConfigExists(): Promise<void> {
  const existing = await getGlobalAssistantConfig();
  if (!existing) {
    await setGlobalAssistantConfig(DEFAULT_ASSISTANT_CONFIG);
  }
}

// Phase 1 (sync): wipe KV and upsert basic game configs from seed files.
// Fast — no LLM calls. Games are immediately visible after this completes.
async function wipeAndBasicSeed(
  kv: Deno.Kv,
  now: string,
): Promise<{ games: GameConfig[]; wipeSummary: string }> {
  const games = await buildAllSeedGameConfigs(now);

  const wipeResults: Array<{ prefix: string; deleted: number }> = [];
  for (const prefix of WIPE_PREFIXES) {
    const deleted = await wipePrefix(kv, prefix);
    wipeResults.push({ prefix: prefix.join("/"), deleted });
  }

  for (const game of games) {
    await upsertGameAndIndex(kv, game);
    console.log(`[startup-reset] Seeded basic config: ${game.title}`);
  }

  await ensureGlobalAssistantConfigExists();

  return {
    games,
    wipeSummary: wipeResults.map((r) => `${r.prefix}:${r.deleted}`).join(", "),
  };
}

// Phase 2 (async): run LLM hardening on all seed games and update KV.
// Runs in the background after the server is already accepting requests.
async function hardenSeedGames(kv: Deno.Kv, games: GameConfig[]): Promise<void> {
  for (const game of games) {
    console.log(`[startup-harden] Hardening: ${game.title}`);
    const result = await initializeGame(game);

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.warn(`[startup-harden] Warning: ${err}`);
      }
    }

    const hardenedGame: GameConfig = {
      ...game,
      characters: result.characters,
      initialized: true,
    };

    await upsertGameAndIndex(kv, hardenedGame);
    console.log(`[startup-harden] Done: ${game.title}`);
  }
}

// Sync startup: wipe + basic seed. Awaited in main.ts so games are in KV
// before the server starts accepting requests.
export async function startupSync(): Promise<void> {
  const kv = await getKv();
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID")?.trim() ?? "";
  const now = new Date().toISOString();

  if (!env.resetGameStateOnStartup) {
    const games = await buildAllSeedGameConfigs(now);
    for (const game of games) {
      await upsertGameAndIndex(kv, game);
    }
    await ensureGlobalAssistantConfigExists();
    console.log(`[startup-reset] flag off: seed-only upsert complete`);
    return;
  }

  if (deploymentId) {
    const key = markerKey(deploymentId);
    const claimed = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, {
        deploymentId,
        gameSlug: "",
        appliedAt: now,
      } as ResetMarker)
      .commit();

    if (!claimed.ok) {
      console.log(
        `[startup-reset] skip: already applied for deployment ${deploymentId}`,
      );
      return;
    }
  }

  const { games, wipeSummary } = await wipeAndBasicSeed(kv, now);

  if (deploymentId) {
    await kv.set(markerKey(deploymentId), {
      deploymentId,
      gameSlug: games.map((g) => g.slug).join(","),
      appliedAt: now,
    } as ResetMarker);
  }

  console.log(
    `[startup-reset] wiped (${wipeSummary}); seeded ${games.map((g) => `/game/${g.slug}`).join(", ")}`,
  );

  // Kick off background hardening
  hardenSeedGames(kv, games).catch((err) => {
    console.error("[startup-harden] fatal:", err);
  });
}
