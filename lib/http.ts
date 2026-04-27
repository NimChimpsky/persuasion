export function redirect(req: Request, path: string, status = 303): Response {
  return Response.redirect(new URL(path, req.url), status);
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function isJsonRequest(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  const contentType = req.headers.get("content-type") ?? "";
  return accept.includes("application/json") ||
    contentType.includes("application/json");
}

export async function readJsonBody<T>(
  req: Request,
): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await req.json() as T };
  } catch {
    return { ok: false };
  }
}
