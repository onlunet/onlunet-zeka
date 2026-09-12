/**
 * ONLUNET ZEKA - FAZ 63 Fallback Routing Suite
 * Validates fallback designation within matching security boundary
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 63.23: Failure Fallback & Boundary Confinement', () => {
  it('designates fallback within the same security classification boundary', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Critical internal database migration',
      dataClassification: DataClassification.RESTRICTED
    });

    assert.equal(decision.selectedProvider, 'local');
    // Fallback must NOT jump to cloud!
    if (decision.fallbackProvider) {
      assert.ok(['local', 'local-provider', 'ollama', 'vllm', 'test-mock'].includes(decision.fallbackProvider));
    }
  });
});
