/**
 * ONLUNET ZEKA - AI Provider Gateway Cost & Budget Tracker
 * FAZ 58 Foundation: Token Accounting, Cost Estimation & Hard Budget Enforcement
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';

/**
 * Standard Pricing Table in USD per 1 Million Tokens (Input / Output)
 */
export const MODEL_PRICING = Object.freeze({
  // OpenAI
  'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.00 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'o1': { inputPerMillion: 15.00, outputPerMillion: 60.00 },
  'o3-mini': { inputPerMillion: 1.10, outputPerMillion: 4.40 },

  // Anthropic
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-haiku-20241022': { inputPerMillion: 0.80, outputPerMillion: 4.00 },
  'claude-3-opus-20240229': { inputPerMillion: 15.00, outputPerMillion: 75.00 },

  // Google / Gemini
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  'gemini-3.6-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  'gemini-3.8-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },

  // Groq
  'openai/gpt-oss-120b': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'qwen/qwen3.8-27b': { inputPerMillion: 0.20, outputPerMillion: 0.20 },
  'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },

  // OpenRouter
  'openrouter/auto': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  'deepseek/deepseek-v4-flash-0731': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek/deepseek-chat': { inputPerMillion: 0.14, outputPerMillion: 0.28 },

  // Local / Test Models
  'local-mock': { inputPerMillion: 0.0, outputPerMillion: 0.0 },
  'local-standard': { inputPerMillion: 0.0, outputPerMillion: 0.0 },
  'local-deterministic-v1': { inputPerMillion: 0.0, outputPerMillion: 0.0 }
});

/**
 * Fast conservative heuristic token estimator for fallback when API response lacks usage metrics.
 * 1 token ~ 4 characters.
 */
export function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculates estimated USD cost for given model and token counts.
 */
export function calculateCost({ providerId, model, inputTokens = 0, outputTokens = 0 }) {
  const normalizedModel = (model || '').toLowerCase();
  
  // Find matching pricing key
  let pricing = MODEL_PRICING[normalizedModel];
  if (!pricing) {
    for (const [key, rate] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        pricing = rate;
        break;
      }
    }
  }

  const parseSafeTokens = (val) => {
    if (typeof val === 'number') {
      if (!Number.isFinite(val) || val < 0) return 0;
      return Math.floor(val);
    }
    const parsed = parseInt(val, 10);
    return (!isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) ? parsed : 0;
  };
  const inTokens = parseSafeTokens(inputTokens);
  const outTokens = parseSafeTokens(outputTokens);
  const totalTokens = inTokens + outTokens;

  if (!pricing) {
    return Object.freeze({
      estimatedCostUsd: null,
      currency: 'USD',
      inputTokens: inTokens,
      outputTokens: outTokens,
      totalTokens,
      pricingKnown: false
    });
  }

  const cost = (inTokens * pricing.inputPerMillion / 1_000_000) + (outTokens * pricing.outputPerMillion / 1_000_000);

  return Object.freeze({
    estimatedCostUsd: Number(cost.toFixed(6)),
    currency: 'USD',
    inputTokens: inTokens,
    outputTokens: outTokens,
    totalTokens,
    pricingKnown: true
  });
}

/**
 * Budget Tracker that enforces strict caps on:
 * - maxCalls: Maximum number of AI provider dispatches
 * - maxTokens: Cumulative total tokens allowed
 * - maxCostUsd: Maximum cumulative estimated expenditure in USD
 * - maxElapsedTimeMs: Total maximum wall-clock time in milliseconds
 */
export function createBudgetTracker({
  maxCalls = 50,
  maxTotalCalls = null,
  maxTokens = 250_000,
  maxCostUsd = 5.00,
  maxElapsedTimeMs = 300_000
} = {}) {
  const effectiveMaxCalls = maxTotalCalls !== null ? maxTotalCalls : maxCalls;
  const startTime = Date.now();
  let callCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cumulativeCostUsd = 0;

  return Object.freeze({
    get startTime() { return startTime; },
    get maxCalls() { return effectiveMaxCalls; },
    get maxTokens() { return maxTokens; },
    get maxCostUsd() { return maxCostUsd; },
    get maxElapsedTimeMs() { return maxElapsedTimeMs; },

    /**
     * Checks if a planned invocation would breach any budget parameter.
     */
    checkBudget({ estimatedTokens = 0, estimatedCostUsd = 0 } = {}) {
      const elapsed = Date.now() - startTime;
      if (maxElapsedTimeMs <= 0 || elapsed > maxElapsedTimeMs) {
        return {
          allowed: false,
          reason: `Execution elapsed time ${elapsed}ms exceeds maxElapsedTimeMs limit of ${maxElapsedTimeMs}ms`
        };
      }

      if (effectiveMaxCalls <= 0 || callCount + 1 > effectiveMaxCalls) {
        return {
          allowed: false,
          reason: `Provider calls ${callCount + 1} exceeds maxCalls limit of ${effectiveMaxCalls}`
        };
      }

      if (maxTokens <= 0) {
        return {
          allowed: false,
          reason: `Tokens limit maxTokens (${maxTokens}) is non-positive`
        };
      }

      const safeEstTokens = (typeof estimatedTokens === 'number' && Number.isFinite(estimatedTokens) && estimatedTokens > 0) ? estimatedTokens : 0;
      const projectedTokens = totalInputTokens + totalOutputTokens + safeEstTokens;
      if (projectedTokens > maxTokens) {
        return {
          allowed: false,
          reason: `Projected tokens ${projectedTokens} exceeds maxTokens limit of ${maxTokens}`
        };
      }

      if (maxCostUsd < 0 || (maxCostUsd === 0 && (cumulativeCostUsd > 0 || (estimatedCostUsd && estimatedCostUsd > 0)))) {
        return {
          allowed: false,
          reason: `Projected cost exceeds maxCostUsd limit of ${maxCostUsd}`
        };
      }

      if (cumulativeCostUsd >= maxCostUsd && maxCostUsd > 0) {
        return {
          allowed: false,
          reason: `Cumulative cost $${cumulativeCostUsd.toFixed(4)} has exhausted maxCostUsd limit of $${maxCostUsd.toFixed(2)}`
        };
      }

      const safeEstCost = (typeof estimatedCostUsd === 'number' && Number.isFinite(estimatedCostUsd) && estimatedCostUsd > 0) ? estimatedCostUsd : 0;
      const projectedCost = cumulativeCostUsd + safeEstCost;
      if (projectedCost > maxCostUsd) {
        return {
          allowed: false,
          reason: `Projected cost $${projectedCost.toFixed(4)} exceeds maxCostUsd limit of $${maxCostUsd.toFixed(2)}`
        };
      }

      return { allowed: true, reason: null };
    },

    /**
     * Asserts budget limits are adhered to, throwing fail-closed error if breached.
     */
    assertWithinBudget(preCheck = {}) {
      const check = this.checkBudget(preCheck);
      if (!check.allowed) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Budget constraint exceeded: ${check.reason}`);
      }
    },

    /**
     * Records actual usage after a provider response.
     */
    recordUsage({ inputTokens = 0, outputTokens = 0, costUsd = 0 } = {}) {
      callCount += 1;
      const parseSafe = (val) => {
        if (typeof val === 'number') {
          return (Number.isFinite(val) && val > 0) ? Math.floor(val) : 0;
        }
        const parsed = parseInt(val, 10);
        return (!isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) ? parsed : 0;
      };
      const inT = parseSafe(inputTokens);
      const outT = parseSafe(outputTokens);
      totalInputTokens += inT;
      totalOutputTokens += outT;
      if (typeof costUsd === 'number' && Number.isFinite(costUsd) && costUsd > 0) {
        cumulativeCostUsd += costUsd;
      }

      return this.getSummary();
    },

    /**
     * Returns an immutable summary snapshot.
     */
    getSummary() {
      const elapsed = Date.now() - startTime;
      const totalTokens = totalInputTokens + totalOutputTokens;
      return Object.freeze({
        callCount,
        maxCalls,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        maxTokens,
        cumulativeCostUsd: Number(cumulativeCostUsd.toFixed(6)),
        maxCostUsd,
        elapsedTimeMs: elapsed,
        maxElapsedTimeMs,
        withinBudget: (
          callCount <= maxCalls &&
          totalTokens <= maxTokens &&
          cumulativeCostUsd <= maxCostUsd &&
          elapsed <= maxElapsedTimeMs
        )
      });
    },

    getStatus() {
      return this.getSummary();
    }
  });
}
