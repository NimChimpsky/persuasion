import { env } from "./env.ts";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalhostRequest(url: URL): boolean {
  return LOCAL_HOSTNAMES.has(url.hostname);
}

export function isLocalDevMode(): boolean {
  return !env.resendApiKey;
}

export function canUseLocalDevAuth(url: URL): boolean {
  return isLocalhostRequest(url) && isLocalDevMode();
}
