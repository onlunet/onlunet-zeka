/**
 * ONLUNET ZEKA - FAZ 63 Model Registry Validation Suite
 * Validates model registry integrity and unverified model status
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createModelRegistry } from '../src/providers/model-registry.js';

describe('FAZ 63.5 & 63.6: Model Registry Validation & Capability Verification', () => {
  it('validates canonical models have defined context windows and capabilities', () => {
    const reg = createModelRegistry();
    const gpt4o = reg.getModel('gpt-4o');
    assert.ok(gpt4o);
    assert.equal(gpt4o.providerId, 'openai');
    assert.ok(gpt4o.contextWindow >= 128000);
    assert.ok(gpt4o.capabilities.includes('TEXT'));

    const sonnet = reg.getModel('claude-3-5-sonnet-20241022');
    assert.ok(sonnet);
    assert.equal(sonnet.providerId, 'anthropic');
  });

  it('marks nonexistent or unverified model as null without fabricating synthetic capabilities', () => {
    const reg = createModelRegistry();
    const phantom = reg.getModel('gpt-99-turbo-quantum');
    assert.strictEqual(phantom, null);
  });
});
