export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Flat token pricing in USD per 1M tokens — provider-agnostic.
// Adjust these two constants to change what users are charged.
const INPUT_PRICE_PER_1M = 0.60;
const OUTPUT_PRICE_PER_1M = 2.20;

// Credit system: $1 = 100 credits, 10× markup on base token cost.
// credits = actual_cost_usd × 10 × 100 = actual_cost_usd × 1000
export function calculateCredits(_provider: string, usage: TokenUsage): number {
  const inputCost = (usage.inputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
  const outputCost = (usage.outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;
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
