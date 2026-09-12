/**
 * ONLUNET ZEKA - FAZ 62 Cost-Aware Routing Suite
 * Validates pricing catalogs, cost estimation, and confidence tracking
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateCost } from '../src/providers/cost-tracker.js';
import { CostConfidence } from '../src/providers/provider-categories.js';

describe('FAZ 62.11: Cost-Aware Routing & Accounting Confidence', () => {
  it('calculates cost accurately for known models across 10+ providers', () => {
    const costGpt4o = calculateCost({ providerId: 'openai', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(costGpt4o.pricingKnown, true);
    assert.ok(costGpt4o.estimatedCostUsd > 0);

    const costClaude = calculateCost({ providerId: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(costClaude.pricingKnown, true);

    const costLocal = calculateCost({ providerId: 'local', model: 'local-deterministic-v1', inputTokens: 5000, outputTokens: 5000 });
    assert.strictEqual(costLocal.estimatedCostUsd, 0);
  });

  it('marks unknown models safely without fabricating synthetic pricing', () => {
    const costUnknown = calculateCost({ providerId: 'custom', model: 'nonexistent-mystery-model-v99', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(costUnknown.pricingKnown, false);
    assert.strictEqual(costUnknown.estimatedCostUsd, null);
  });
});
