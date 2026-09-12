/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Model Validation Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createModelRegistry } from '../src/providers/model-registry.js';

describe('FAZ 64.14: OpenAI Model Registry Validation', () => {
  it('validates supported OpenAI models and rejects nonexistent models', () => {
    const reg = createModelRegistry();
    assert.ok(reg.getModel('gpt-4o'));
    assert.ok(reg.getModel('gpt-4o-mini'));
    assert.ok(reg.getModel('o1'));
    assert.ok(reg.getModel('o3-mini'));
    assert.strictEqual(reg.getModel('gpt-nonexistent-v99'), null);
  });
});
