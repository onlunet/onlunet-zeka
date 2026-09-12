/**
 * ONLUNET ZEKA - FAZ 63 Intelligent Multi-Factor Routing Suite
 * Validates end-to-end task analysis -> capability matching -> weighted scoring
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';

describe('FAZ 63.10 & 63.11: Multi-Factor Intelligent Routing', () => {
  it('routes task intelligently and returns structured explanation', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const modelRegistry = createModelRegistry();
    const router = createRoutingEngine({ registry, modelRegistry });

    const decision = router.route({
      task: 'Write a quick function to sort numbers in ascending order'
    });

    assert.ok(decision.selectedProvider);
    assert.ok(decision.selectedModel);
    assert.ok(Array.isArray(decision.reasons));
    assert.ok(decision.reasons.length > 0);
    assert.strictEqual(decision.executionAuthorized, false);
    assert.strictEqual(decision.proposalOnly, true);
  });
});
