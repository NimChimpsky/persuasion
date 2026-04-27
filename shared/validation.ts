import type { UserGender } from "./types.ts";

export const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USER_GENDERS: readonly UserGender[] = [
  "male",
  "female",
  "non-binary",
] as const;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return BASIC_EMAIL_REGEX.test(normalizeEmail(input));
}

export function isUserGender(value: string): value is UserGender {
  return USER_GENDERS.includes(value as UserGender);
}

export function normalizeGender(
  input: string,
  fallback: UserGender = "male",
): UserGender {
  const value = input.trim().toLowerCase();
  return isUserGender(value) ? value : fallback;
}
