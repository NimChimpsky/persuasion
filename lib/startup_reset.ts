import { getKv } from "./kv.ts";
import {
  buildOliveFarmGameConfig,
  upsertGameAndIndex,
} from "./local_seed_game.ts";

// TEMPORARY EARLY-DEV BOOTSTRAP
// This module intentionally wipes game data and reseeds one test game at app startup.
// Remove this file + main.ts startup call when moving to non-destructive environments.
//
// Current behavior:
// - Wipes prefixes: games_by_slug, games_index, user_progress
// - Seeds: murder-at-the-olive-farm.txt
// - Frequency:
//   - Once per deployment when DENO_DEPLOYMENT_ID is present
//   - Every startup when DENO_DEPLOYMENT_ID is absent (local)

const RESET_VERSION = "olive_farm_seed_v1";
const DELETE_BATCH_SIZE = 10;

const WIPE_PREFIXES: Deno.KvKey[] = [
  ["games_by_slug"],
  ["games_index"],
  ["user_progress"],
];

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

export async function resetAndSeedOliveFarmOnStartup(): Promise<void> {
  const kv = await getKv();
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID")?.trim() ?? "";
  const now = new Date().toISOString();

  if (deploymentId) {
    const marker = await kv.get<ResetMarker>(markerKey(deploymentId));
    if (marker.value) {
      console.log(
        `[startup-reset] skip: already applied for deployment ${deploymentId}`,
      );
      return;
    }
  }

  // Fail before destructive wipe if source game file is invalid.
  const game = await buildOliveFarmGameConfig(now);

  const wipeResults: Array<{ prefix: string; deleted: number }> = [];
  for (const prefix of WIPE_PREFIXES) {
    const deleted = await wipePrefix(kv, prefix);
    wipeResults.push({ prefix: prefix.join("/"), deleted });
  }

  await upsertGameAndIndex(kv, game);

  if (deploymentId) {
    await kv.set(markerKey(deploymentId), {
      version: RESET_VERSION,
      deploymentId,
      gameSlug: game.slug,
      appliedAt: now,
    } as ResetMarker);
  }

  const summary = wipeResults.map((item) => `${item.prefix}:${item.deleted}`)
    .join(", ");
  console.log(`[startup-reset] applied (${summary}); seeded /game/${game.slug}`);
}
