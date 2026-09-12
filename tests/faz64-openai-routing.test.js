/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Intelligent Routing Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 64.15: Intelligent Routing for OpenAI', () => {
  it('routes public coding task with structured explanation and zero authority', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Refactor sorting algorithm',
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'openai'
    });

    assert.equal(decision.selectedProvider, 'openai');
    assert.strictEqual(decision.executionAuthorized, false);
    assert.strictEqual(decision.proposalOnly, true);
    assert.ok(decision.reasons.length > 0);
  });
});
