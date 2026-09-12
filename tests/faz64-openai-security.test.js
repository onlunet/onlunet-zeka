/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Security Confinement Suite
 * Validates TEST 1 through TEST 4 (SECRET, RESTRICTED, CRITICAL, PUBLIC)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 64.11: OpenAI Security Classification Confinement', () => {
  const registry = createProviderRegistry({ includeBuiltins: true });
  const router = createRoutingEngine({ registry });

  it('TEST 1: SECRET + preferredProvider=openai blocks cloud and selects local', () => {
    const decision = router.route({
      task: 'Process internal secret credentials',
      dataClassification: DataClassification.SECRET,
      preferredProvider: 'openai'
    });
    assert.equal(decision.selectedProvider, 'local');
    assert.ok(decision.rejectedCandidates.some(r => r.provider === 'openai'));
  });

  it('TEST 2: RESTRICTED + preferredProvider=openai blocks cloud and selects local', () => {
    const decision = router.route({
      task: 'Process customer restricted records',
      dataClassification: DataClassification.RESTRICTED,
      preferredProvider: 'openai'
    });
    assert.equal(decision.selectedProvider, 'local');
    assert.ok(decision.rejectedCandidates.some(r => r.provider === 'openai'));
  });

  it('TEST 3: CRITICAL + preferredProvider=openai blocks cloud and selects local', () => {
    const decision = router.route({
      task: 'Process critical authority data',
      dataClassification: 'CRITICAL',
      preferredProvider: 'openai'
    });
    assert.equal(decision.selectedProvider, 'local');
    assert.ok(decision.rejectedCandidates.some(r => r.provider === 'openai'));
  });

  it('TEST 4: PUBLIC + preferredProvider=openai allows openai as eligible', () => {
    const decision = router.route({
      task: 'General knowledge question',
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'openai'
    });
    assert.equal(decision.selectedProvider, 'openai');
  });
});
