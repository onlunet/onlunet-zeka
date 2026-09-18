# FAZ 64 — OpenAI Usage & Cost Tracking Report

## 1. Token Accounting
- OpenAI `usage` block mapped directly:
  - `prompt_tokens` -> `inputTokens`
  - `completion_tokens` -> `outputTokens`
  - `total_tokens` -> `totalTokens`
- Zero synthetic hallucination: If provider omits usage, `estimateTokenCount` estimates non-authoritatively with explicit flag.

## 2. Cost Calculation Matrix
| Model | Input / 1M | Output / 1M | Pricing Known |
|-------|------------|-------------|---------------|
| `gpt-4o` | $2.50 | $10.00 | YES |
| `gpt-4o-mini` | $0.15 | $0.60 | YES |
| `o1` | $15.00 | $60.00 | YES |
| `o3-mini` | $1.10 | $4.40 | YES |
| Unknown models | N/A | N/A | NO (`pricingKnown: false`, `estimatedCostUsd: null`) |
