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

// Bump this string to force a re-seed on the next startup even if the deployment ID hasn't changed.
const RESET_VERSION = "seed_v1";
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
  bio: "Your investigation assistant who helps you decide practical next steps.",
  systemPrompt:
    "You are the player's investigation assistant. Stay supportive, practical, and grounded in observable evidence. Ask useful follow-up questions, suggest sensible next steps, and avoid spoilers.",
};

interface ResetMarker {
  version: string;
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
  return ["startup_reset", RESET_VERSION, deploymentId];
}

async function ensureGlobalAssistantConfigExists(): Promise<void> {
  const existing = await getGlobalAssistantConfig();
  if (!existing) {
    await setGlobalAssistantConfig(DEFAULT_ASSISTANT_CONFIG);
  }
}

async function initializeAndPersist(
  kv: Deno.Kv,
  game: GameConfig,
): Promise<GameConfig> {
  console.log(`[startup-reset] Initializing game: ${game.title}`);
  const result = await initializeGame(game);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(`[startup-reset] Initializer warning: ${err}`);
    }
  }

  const initializedGame: GameConfig = {
    ...game,
    characters: result.characters,
    initialized: true,
  };

  await upsertGameAndIndex(kv, initializedGame);
  return initializedGame;
}

async function buildAllSeedGames(now: string) {
  return await buildAllSeedGameConfigs(now);
}

async function seedOnly(
  kv: Deno.Kv,
  now: string,
): Promise<string[]> {
  const games = await buildAllSeedGames(now);
  for (const game of games) {
    await initializeAndPersist(kv, game);
  }
  await ensureGlobalAssistantConfigExists();
  return games.map((g) => g.slug);
}

async function wipeGameDataAndSeed(
  kv: Deno.Kv,
  now: string,
): Promise<{ gameSlugs: string[]; wipeSummary: string }> {
  const games = await buildAllSeedGames(now);

  const wipeResults: Array<{ prefix: string; deleted: number }> = [];
  for (const prefix of WIPE_PREFIXES) {
    const deleted = await wipePrefix(kv, prefix);
    wipeResults.push({ prefix: prefix.join("/"), deleted });
  }

  for (const game of games) {
    await initializeAndPersist(kv, game);
  }
  await ensureGlobalAssistantConfigExists();

  return {
    gameSlugs: games.map((g) => g.slug),
    wipeSummary: wipeResults.map((item) => `${item.prefix}:${item.deleted}`)
      .join(", "),
  };
}

export async function resetAndSeedOliveFarmOnStartup(): Promise<void> {
  const kv = await getKv();
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID")?.trim() ?? "";
  const now = new Date().toISOString();

  if (!env.resetGameStateOnStartup) {
    const slugs = await seedOnly(kv, now);
    console.log(
      `[startup-reset] flag off (RESET_GAME_STATE_ON_STARTUP=false): seed-only upsert ${slugs.map((s) => `/game/${s}`).join(", ")}`,
    );
    return;
  }

  if (deploymentId) {
    const key = markerKey(deploymentId);
    const claimed = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, {
        version: RESET_VERSION,
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

  const { gameSlugs, wipeSummary } = await wipeGameDataAndSeed(kv, now);

  if (deploymentId) {
    await kv.set(markerKey(deploymentId), {
      version: RESET_VERSION,
      deploymentId,
      gameSlug: gameSlugs.join(","),
      appliedAt: now,
    } as ResetMarker);
  }

  console.log(`[startup-reset] applied (${wipeSummary}); seeded ${gameSlugs.map((s) => `/game/${s}`).join(", ")}`);
}
