# FAZ 66 — Gemini Usage & Cost Accounting Report

## 1. Token Tracking
- Native token counts extracted from `usageMetadata.promptTokenCount` and `usageMetadata.candidatesTokenCount`.
- Conservative heuristic fallback (`Math.ceil(text.length / 4)`) if metadata is absent.

## 2. Cost Calculations
- Precision: 6 decimal places in USD.
- Formula: `(inTokens * inputRate + outTokens * outputRate) / 1,000,000`
- Hard budget enforcement: Pre-flight check via `budgetTracker.checkBudget()` rejects calls when budget is exceeded.
