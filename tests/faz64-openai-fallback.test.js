/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Fallback Routing Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 64.13: OpenAI Fallback Routing & Boundary Preservation', () => {
  it('designates compliant fallback provider without violating security boundaries', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Customer restricted task',
      dataClassification: DataClassification.RESTRICTED,
      preferredProvider: 'openai'
    });

    assert.equal(decision.selectedProvider, 'local');
    if (decision.fallbackProvider) {
      assert.ok(['local', 'local-provider', 'ollama', 'vllm', 'test-mock'].includes(decision.fallbackProvider));
    }
  });
});
