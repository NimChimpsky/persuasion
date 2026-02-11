let kvPromise: Promise<Deno.Kv> | null = null;
let didLogInit = false;

function hasNativeOpenKv(): boolean {
  const maybeOpenKv = (Deno as unknown as { openKv?: unknown }).openKv;
  return typeof maybeOpenKv === "function";
}

function shortStack(): string {
  return (new Error().stack ?? "")
    .split("\n")
    .slice(2, 5)
    .map((line) => line.trim())
    .join(" | ");
}

export function getKv(source = "unknown"): Promise<Deno.Kv> {
  const openKvAvailable = hasNativeOpenKv();
  const denoVersion = (Deno as unknown as { version?: { deno?: string } })
    .version?.deno ?? "unknown";

  console.info("[kv] getKv called", {
    source,
    openKvAvailable,
    denoVersion,
    initialized: Boolean(kvPromise),
    stack: shortStack(),
  });

  if (!openKvAvailable) {
    console.error("[kv] Deno.openKv unavailable", {
      source,
      denoVersion,
      stack: shortStack(),
    });
    throw new Error(
      "Deno KV is required but Deno.openKv is unavailable. Use a runtime that supports Deno KV and ensure KV is enabled (for older Deno runtimes, start with --unstable-kv).",
    );
  }

  if (!kvPromise) {
    if (!didLogInit) {
      didLogInit = true;
      console.info("[kv] Initializing Deno KV");
    }
    kvPromise = Deno.openKv();
  }

  return kvPromise;
}
