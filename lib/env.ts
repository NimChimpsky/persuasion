function parseCsvSet(input: string | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    input.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const env = {
  adminEmails: parseCsvSet(Deno.env.get("ADMIN_EMAILS")),
  llmBaseUrl: Deno.env.get("LLM_BASE_URL") ?? "https://api.openai.com/v1",
  llmApiKey: Deno.env.get("LLM_API_KEY") ?? "",
  llmModel: Deno.env.get("LLM_MODEL") ?? "gpt-4.1-mini",
  resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
  emailFrom: Deno.env.get("EMAIL_FROM") ?? "",
  magicLinkPreview: (Deno.env.get("MAGIC_LINK_PREVIEW") ?? "true") === "true",
  localDevAuthSecret: Deno.env.get("LOCAL_DEV_AUTH_SECRET") ?? "",
  localDevAuthEmail: Deno.env.get("LOCAL_DEV_AUTH_EMAIL") ?? "dev@local.test",
};

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.has(email.toLowerCase());
}
