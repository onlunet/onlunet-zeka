/**
 * ONLUNET ZEKA - FAZ 63 Security First Routing Suite
 * Validates hard security constraints for SECRET and RESTRICTED data
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 63.12 & 63.13: Security First Hard Constraint Routing', () => {
  it('strictly confines SECRET data to local airgapped providers', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Process internal employee keys',
      dataClassification: DataClassification.SECRET,
      preferredProvider: 'openai'
    });

    assert.equal(decision.selectedProvider, 'local');
    assert.ok(decision.rejectedCandidates.some(r => r.provider === 'openai'));
  });

  it('fails closed when no local provider supports required capabilities for RESTRICTED data', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    // Local does not support AUDIO capability
    assert.throws(() => {
      router.route({
        task: 'Transcribe audio meeting recording',
        dataClassification: DataClassification.RESTRICTED,
        requiredCapabilities: ['AUDIO']
      });
    }, /CAPABILITY_UNSUPPORTED/);
  });
});
