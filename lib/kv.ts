let kvPromise: Promise<Deno.Kv> | null = null;

function hasNativeOpenKv(): boolean {
  const maybeOpenKv = (Deno as unknown as { openKv?: unknown }).openKv;
  return typeof maybeOpenKv === "function";
}

export function getKv(): Promise<Deno.Kv> {
  if (!hasNativeOpenKv()) {
    throw new Error(
      "Deno KV is required but Deno.openKv is unavailable. Use a runtime that supports Deno KV and ensure KV is enabled (for older Deno runtimes, start with --unstable-kv).",
    );
  }

  if (!kvPromise) {
    kvPromise = Deno.openKv();
  }

  return kvPromise;
}
