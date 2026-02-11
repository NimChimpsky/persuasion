import {
  deleteCookie,
  getCookies,
  setCookie,
} from "jsr:@std/http@1.0.20/cookie";
import { env } from "./env.ts";
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

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/g,
    "",
  );
}

function fromBase64Url(input: string): Uint8Array<ArrayBuffer> | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;

function getMagicLinkHmacKey(): Promise<CryptoKey> {
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.magicLinkSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return hmacKeyPromise;
}

async function signMagicNonce(nonce: string): Promise<string> {
  const key = await getMagicLinkHmacKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(nonce),
  );
  return toBase64Url(new Uint8Array(signature));
}

async function verifyMagicNonce(
  nonce: string,
  signatureB64Url: string,
): Promise<boolean> {
  const signature = fromBase64Url(signatureB64Url);
  if (!signature) return false;

  const key = await getMagicLinkHmacKey();
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(nonce),
  );
}

function parseMagicToken(
  token: string,
): [nonce: string, signature: string] | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [nonce, signature] = parts;
  if (!/^[a-f0-9]{64}$/i.test(nonce)) return null;
  if (!signature) return null;
  return [nonce, signature];
}

export async function createMagicToken(email: string): Promise<string> {
  const kv = await getKv();
  const nonce = randomToken();
  const signature = await signMagicNonce(nonce);
  const token = `${nonce}.${signature}`;

  await kv.set(["magic_tokens", nonce], {
    email,
    createdAt: new Date().toISOString(),
  } as MagicTokenRecord);

  return token;
}

export async function consumeMagicToken(token: string): Promise<string | null> {
  const parsedToken = parseMagicToken(token);
  if (!parsedToken) return null;

  const [nonce, signature] = parsedToken;
  const validSignature = await verifyMagicNonce(nonce, signature);
  if (!validSignature) return null;

  const kv = await getKv();
  const key = ["magic_tokens", nonce] as const;
  const entry = await kv.get<MagicTokenRecord>(key);
  if (!entry.value) return null;

  const result = await kv.atomic().check(entry).delete(key).commit();
  if (!result.ok) return null;

  return entry.value.email;
}

export async function createSession(email: string): Promise<string> {
  const kv = await getKv();
  const sessionId = randomToken();

  const record = {
    email,
    createdAt: new Date().toISOString(),
  } as SessionRecord;

  await kv.set(["sessions", sessionId], record);
  await kv.set(["sessions_by_user", email, sessionId], {
    createdAt: record.createdAt,
  });

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
  const sessionEntry = await kv.get<SessionRecord>(["sessions", sessionId]);
  await kv.delete(["sessions", sessionId]);
  if (sessionEntry.value) {
    await kv.delete(["sessions_by_user", sessionEntry.value.email, sessionId]);
  }
}

export async function destroyAllSessionsForEmail(email: string): Promise<void> {
  const kv = await getKv();
  const prefix: Deno.KvKey = ["sessions_by_user", email];
  const sessionIds: string[] = [];

  for await (const entry of kv.list<{ createdAt: string }>({ prefix })) {
    const maybeSessionId = entry.key[2];
    if (typeof maybeSessionId === "string") {
      sessionIds.push(maybeSessionId);
    }
  }

  await Promise.all(
    sessionIds.map(async (sessionId) => {
      await kv.delete(["sessions", sessionId]);
      await kv.delete(["sessions_by_user", email, sessionId]);
    }),
  );
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
