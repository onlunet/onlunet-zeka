/**
 * ONLUNET ZEKA - FAZ 62 Capability Routing Suite
 * Validates canonical capability matching and CAPABILITY_UNSUPPORTED handling
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';

describe('FAZ 62.7: Capability Matrix & Routing', () => {
  it('routes correctly when required capabilities are satisfied', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const modelRegistry = createModelRegistry();
    const router = createRoutingEngine({ registry, modelRegistry });

    const decision = router.route({
      taskType: 'coding',
      requiredCapabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT]
    });

    assert.ok(decision.selectedProvider);
    assert.ok(decision.selectedModel);
    assert.equal(decision.securityStatus, 'PERMITTED');
  });

  it('fails closed with CAPABILITY_UNSUPPORTED when no provider supports requested capability combination', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    assert.throws(
      () => {
        router.route({
          requiredCapabilities: ['HYPOTHETICAL_TELEPATHIC_CAPABILITY_XYZ']
        });
      },
      (err) => {
        assert.equal(err.code, 'CAPABILITY_UNSUPPORTED');
        return true;
      }
    );
  });
});
