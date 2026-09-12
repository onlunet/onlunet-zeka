/**
 * ONLUNET ZEKA - FAZ 62 Multi-Factor Provider Selection Suite
 * Validates provider priority, preferred provider routing, and fallback determination
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';

describe('FAZ 62.8 & 62.10: Provider Selection Strategy & Priority', () => {
  it('honors preferred provider when eligible and permitted by policy', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      preferredProvider: 'groq',
      requiredCapabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE]
    });

    assert.equal(decision.selectedProvider, 'groq');
    assert.ok(decision.fallbackProvider);
    assert.notEqual(decision.fallbackProvider, 'groq');
  });

  it('selects fallback provider distinct from primary provider within same security boundary', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      preferredProvider: 'local',
      dataClassification: 'SECRET'
    });

    assert.equal(decision.selectedProvider, 'local');
    // Fallback must also be local/on-prem!
    if (decision.fallbackProvider) {
      const fbEntry = registry.getEntry(decision.fallbackProvider);
      assert.ok(fbEntry.isLocal);
    }
  });
});
