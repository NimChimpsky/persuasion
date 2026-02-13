import { env } from "./env.ts";
import { getKv } from "./kv.ts";

export type LlmProvider = "deepseek" | "openai";

interface LlmProviderRecord {
  provider: LlmProvider;
  updatedAt: string;
  updatedBy: string;
}

interface LlmProviderConfig {
  id: LlmProvider;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmProviderOption {
  id: LlmProvider;
  label: string;
  configured: boolean;
}

const LLM_PROVIDER_KEY = ["app_settings", "llm_provider"] as const;
const DEFAULT_LLM_PROVIDER: LlmProvider = "deepseek";

export function isLlmProvider(value: string): value is LlmProvider {
  return value === "deepseek" || value === "openai";
}

export function getLlmProviderConfig(provider: LlmProvider): LlmProviderConfig {
  if (provider === "openai") {
    return {
      id: "openai",
      label: "OpenAI",
      baseUrl: env.openaiBaseUrl,
      apiKey: env.openaiApiKey,
      model: env.openaiModel,
    };
  }

  return {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: env.deepseekBaseUrl,
    apiKey: env.deepseekApiKey,
    model: env.deepseekModel,
  };
}

export function listLlmProviderOptions(): LlmProviderOption[] {
  const providers: LlmProvider[] = ["deepseek", "openai"];
  return providers.map((provider) => {
    const config = getLlmProviderConfig(provider);
    return {
      id: provider,
      label: config.label,
      configured: Boolean(config.apiKey),
    };
  });
}

export async function getActiveLlmProvider(): Promise<LlmProvider> {
  const kv = await getKv();
  const entry = await kv.get<LlmProviderRecord>(LLM_PROVIDER_KEY);
  if (!entry.value || !isLlmProvider(entry.value.provider)) {
    return DEFAULT_LLM_PROVIDER;
  }
  return entry.value.provider;
}

export async function setActiveLlmProvider(
  provider: LlmProvider,
  adminEmail: string,
): Promise<void> {
  const kv = await getKv();
  await kv.set(LLM_PROVIDER_KEY, {
    provider,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  } as LlmProviderRecord);
}
