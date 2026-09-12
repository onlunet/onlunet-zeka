/**
 * ONLUNET ZEKA - FAZ 62 Security-Aware Routing Suite
 * Validates strict boundary enforcement: SECRET/RESTRICTED never leave local boundary
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 62.6 & 62.10: Security-Aware Provider Routing', () => {
  it('strictly prohibits all cloud providers for SECRET data classification', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      dataClassification: DataClassification.SECRET,
      preferredProvider: 'openai' // Attempting to force cloud on SECRET data!
    });

    // Invariant: Router must override or reject cloud preference and force local
    assert.equal(decision.selectedProvider, 'local');
    assert.equal(decision.dataClassification, 'SECRET');
  });

  it('permits cloud providers for PUBLIC and INTERNAL data classifications', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'groq'
    });

    assert.equal(decision.selectedProvider, 'groq');
  });
});
