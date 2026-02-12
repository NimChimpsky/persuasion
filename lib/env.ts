function parseCsvSet(input: string | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    input.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const env = {
  appBaseUrl: Deno.env.get("APP_BASE_URL") ?? "https://persuasion.technology",
  adminEmails: parseCsvSet(Deno.env.get("ADMIN_EMAILS")),
  llmBaseUrl: Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1",
  llmApiKey: Deno.env.get("LLM_API_KEY") ?? "",
  llmModel: Deno.env.get("LLM_MODEL") ?? "gpt-4.1-mini",
  resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
  emailFrom: Deno.env.get("EMAIL_FROM") ?? "gamesmaster@persuasion.technology",
  magicLinkSecret: Deno.env.get("MAGIC_LINK_SECRET") ??
    "2Qv9hJr6Kx1mNp4Tz8bCd3Fw7Ls5Ye0Au2Hi9Mn6Rx4VqPk1",
  magicLinkPreview: (Deno.env.get("MAGIC_LINK_PREVIEW") ?? "true") === "true",
  localDevAuthEmail: Deno.env.get("LOCAL_DEV_AUTH_EMAIL") ?? "dev@local.test",
};

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.has(email.toLowerCase());
}
