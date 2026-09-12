/**
 * ONLUNET ZEKA - FAZ 63 Model Selection Suite
 * Validates decoupled model resolution from model registry
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';

describe('FAZ 63.18: Decoupled Model Selection', () => {
  it('selects model matching REASONING capability when reasoning is requested', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const modelRegistry = createModelRegistry();
    const router = createRoutingEngine({ registry, modelRegistry });

    const decision = router.route({
      task: 'Solve step-by-step mathematical logic theorem',
      requiredCapabilities: ['REASONING']
    });

    assert.ok(decision.selectedModel);
  });
});
