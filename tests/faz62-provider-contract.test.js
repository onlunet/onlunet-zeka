/**
 * ONLUNET ZEKA - FAZ 62 Provider Contract Conformance Suite
 * Validates canonical adapter contract across 10+ provider adapters
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { ProviderCategories } from '../src/providers/provider-categories.js';

describe('FAZ 62.2: Canonical Provider Contract Conformance', () => {
  it('verifies that all registered adapters implement canonical contract interface', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const providers = registry.listProviders();

    assert.ok(providers.length >= 10, 'Must have at least 10 providers registered, got: ' + providers.length);

    for (const p of providers) {
      const adapter = registry.getProvider(p.providerId);
      assert.ok(adapter.providerId, 'Provider must have providerId');
      assert.ok(adapter.name, 'Provider must have name');
      assert.ok(Array.isArray(adapter.capabilities), 'Provider must expose capabilities array');
      assert.ok(typeof adapter.checkHealth === 'function' || typeof adapter.healthCheck === 'function', 'Provider must implement health check');
      assert.ok(
        typeof adapter.invoke === 'function' ||
        typeof adapter.chat === 'function' ||
        typeof adapter.generate === 'function',
        'Provider must implement completion/invoke function'
      );
    }
  });

  it('verifies ProviderCategories are defined and properly assigned', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const direct = registry.listProviders().filter(p => p.category === ProviderCategories.DIRECT);
    const local = registry.listProviders().filter(p => p.category === ProviderCategories.LOCAL);
    const inference = registry.listProviders().filter(p => p.category === ProviderCategories.INFERENCE);
    const aggregator = registry.listProviders().filter(p => p.category === ProviderCategories.AGGREGATOR);

    assert.ok(direct.length >= 4, 'Direct category must include multiple providers');
    assert.ok(local.length >= 2, 'Local category must include local and ollama');
    assert.ok(inference.length >= 1, 'Inference category must include groq');
    assert.ok(aggregator.length >= 1, 'Aggregator category must include openrouter');
  });
});
