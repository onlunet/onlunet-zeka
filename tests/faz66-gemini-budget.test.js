import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateCost, MODEL_PRICING } from '../src/providers/cost-tracker.js';

describe('FAZ 66: Gemini Budget & Cost Tracking', () => {
  it('1. Pricing table includes Gemini models', () => {
    assert.ok(MODEL_PRICING['gemini-1.5-flash']);
    assert.ok(MODEL_PRICING['gemini-1.5-pro']);
    assert.ok(MODEL_PRICING['gemini-2.0-flash']);
  });

  it('2. Calculates cost correctly for gemini-1.5-flash', () => {
    const cost = calculateCost({
      providerId: 'gemini',
      model: 'gemini-1.5-flash',
      inputTokens: 1000000,
      outputTokens: 1000000
    });
    assert.strictEqual(cost.estimatedCostUsd, 0.375);
  });

  it('3. Calculates cost correctly for gemini-2.0-flash', () => {
    const cost = calculateCost({
      providerId: 'gemini',
      model: 'gemini-2.0-flash',
      inputTokens: 1000000,
      outputTokens: 1000000
    });
    assert.strictEqual(cost.estimatedCostUsd, 0.50);
  });
});
