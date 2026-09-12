/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Cost Tracking Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateCost } from '../src/providers/cost-tracker.js';

describe('FAZ 64.5: OpenAI Cost Accounting & Unknown Pricing Guard', () => {
  it('calculates cost for known OpenAI models (gpt-4o, gpt-4o-mini, o1, o3-mini)', () => {
    const costGpt4o = calculateCost({ providerId: 'openai', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(costGpt4o.pricingKnown, true);
    assert.ok(costGpt4o.estimatedCostUsd > 0);

    const costMini = calculateCost({ providerId: 'openai', model: 'gpt-4o-mini', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(costMini.pricingKnown, true);
    assert.ok(costMini.estimatedCostUsd > 0);
    assert.ok(costMini.estimatedCostUsd < costGpt4o.estimatedCostUsd);
  });

  it('marks unknown models safely as pricingKnown: false and estimatedCostUsd: null', () => {
    const unknown = calculateCost({ providerId: 'openai', model: 'gpt-99-mystery', inputTokens: 1000, outputTokens: 500 });
    assert.strictEqual(unknown.pricingKnown, false);
    assert.strictEqual(unknown.estimatedCostUsd, null);
  });
});
