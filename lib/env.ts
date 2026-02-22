import "jsr:@std/dotenv@^0.225.0/load";

function parseCsvSet(input: string | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    input.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseBoolean(input: string | undefined, defaultValue: boolean): boolean {
  if (input == null) return defaultValue;
  const normalized = input.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export const env = {
  appBaseUrl: Deno.env.get("APP_BASE_URL") ?? "https://persuasion.technology",
  adminEmails: parseCsvSet(Deno.env.get("ADMIN_EMAILS")),
  openaiBaseUrl: Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
  openaiModel: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
  deepseekBaseUrl: Deno.env.get("DEEPSEEK_BASE_URL") ??
    "https://api.deepseek.com/v1",
  deepseekApiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
  deepseekModel: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat",
  mistralBaseUrl: Deno.env.get("MISTRAL_BASE_URL") ??
    "https://api.mistral.ai/v1",
  mistralApiKey: Deno.env.get("MISTRAL_API_KEY") ?? "",
  mistralModel: Deno.env.get("MISTRAL_MODEL") ?? "mistral-small-latest",
  veniceBaseUrl: Deno.env.get("VENICE_BASE_URL") ??
    "https://api.venice.ai/api/v1",
  veniceApiKey: Deno.env.get("VENICE_API_KEY") ?? "",
  veniceModel: Deno.env.get("VENICE_MODEL") ?? "venice-uncensored",
  resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
  emailFrom: Deno.env.get("EMAIL_FROM") ?? "gamesmaster@persuasion.technology",
  magicLinkSecret: Deno.env.get("MAGIC_LINK_SECRET") ??
    "2Qv9hJr6Kx1mNp4Tz8bCd3Fw7Ls5Ye0Au2Hi9Mn6Rx4VqPk1",
  localDevAuthEmail: Deno.env.get("LOCAL_DEV_AUTH_EMAIL") ?? "dev@local.test",
  // Default ON by design for early dev stages.
  resetGameStateOnStartup: parseBoolean(
    Deno.env.get("RESET_GAME_STATE_ON_STARTUP"),
    true,
  ),
};

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.has(email.toLowerCase());
}
