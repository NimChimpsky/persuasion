export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Provider input/output pricing in USD per 1M tokens.
// These are approximate current rates used to calculate credit charges.
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  openai: { input: 0.25, output: 2.00 }, // gpt-5-mini
  deepseek: { input: 0.28, output: 0.42 }, // deepseek-reasoner (V3.2)
  mistral: { input: 0.10, output: 0.30 }, // mistral-small-creative
  venice: { input: 0.20, output: 0.90 }, // venice-uncensored
};

const FALLBACK_PRICING = { input: 0.50, output: 1.50 };

// Credit system: $1 = 100 credits, 10× markup on actual provider cost.
// credits = actual_cost_usd × 10 × 100 = actual_cost_usd × 1000
export function calculateCredits(provider: string, usage: TokenUsage): number {
  const pricing = PROVIDER_PRICING[provider] ?? FALLBACK_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalUsd = inputCost + outputCost;
  // Round up to 2 decimal places to avoid undercharging.
  return Math.ceil(totalUsd * 100_000) / 100;
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };
