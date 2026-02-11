import {
  deleteCookie,
  getCookies,
  setCookie,
} from "jsr:@std/http@1.0.20/cookie";
import { getKv } from "./kv.ts";

export const SESSION_COOKIE = "story_session";

interface SessionRecord {
  email: string;
  createdAt: string;
}

interface MagicTokenRecord {
  email: string;
  createdAt: string;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
}

export async function createMagicToken(email: string): Promise<string> {
  const kv = await getKv();
  const token = randomToken();

  await kv.set(
    ["magic_tokens", token],
    {
      email,
      createdAt: new Date().toISOString(),
    } as MagicTokenRecord,
    { expireIn: 1000 * 60 * 60 },
  );

  return token;
}

export async function consumeMagicToken(token: string): Promise<string | null> {
  const kv = await getKv();
  const key: Deno.KvKey = ["magic_tokens", token];
  const entry = await kv.get<MagicTokenRecord>(key);
  if (!entry.value) return null;

  const result = await kv.atomic().check(entry).delete(key).commit();
  if (!result.ok) return null;

  return entry.value.email;
}

export async function createSession(email: string): Promise<string> {
  const kv = await getKv();
  const sessionId = randomToken();

  await kv.set(["sessions", sessionId], {
    email,
    createdAt: new Date().toISOString(),
  } as SessionRecord);

  return sessionId;
}

export async function getSessionEmail(req: Request): Promise<string | null> {
  const cookies = getCookies(req.headers);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;

  const kv = await getKv();
  const entry = await kv.get<SessionRecord>(["sessions", sessionId]);
  return entry.value?.email ?? null;
}

export async function destroySession(req: Request): Promise<void> {
  const cookies = getCookies(req.headers);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return;

  const kv = await getKv();
  await kv.delete(["sessions", sessionId]);
}

export function setSessionCookie(
  headers: Headers,
  sessionId: string,
  secure: boolean,
): void {
  setCookie(headers, {
    name: SESSION_COOKIE,
    value: sessionId,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure,
    expires: new Date("2099-12-31T23:59:59.000Z"),
  });
}

export function clearSessionCookie(headers: Headers): void {
  deleteCookie(headers, SESSION_COOKIE, { path: "/" });
}
