/**
 * ONLUNET ZEKA - FAZ 62 Provider Registry 2.0 Test Suite
 * Validates catalog enumeration, metadata indexing, and plugin registration
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';
import { ProviderCategories, ProviderPriority } from '../src/providers/provider-categories.js';

describe('FAZ 62.3: Provider Registry 2.0 Extensibility', () => {
  it('allows registering a new provider plugin without modifying gateway code', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    
    const pluginAdapter = createLocalProviderAdapter({
      providerId: 'custom-academic-lpu',
      name: 'Academic Research LPU',
      model: 'lpu-deep-v1'
    });

    registry.registerProvider(pluginAdapter, {
      category: ProviderCategories.INFERENCE,
      priority: ProviderPriority.SECONDARY,
      enabled: true
    });

    assert.ok(registry.hasProvider('custom-academic-lpu'));
    const entry = registry.getEntry('custom-academic-lpu');
    assert.equal(entry.displayName, 'Academic Research LPU');
    assert.equal(entry.category, ProviderCategories.INFERENCE);
    assert.equal(entry.priority, ProviderPriority.SECONDARY);
  });

  it('rejects prototype pollution attempts in provider registration fail-closed', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const maliciousAdapter = {
      providerId: '__proto__',
      invoke: async () => ({})
    };

    assert.throws(
      () => registry.register(maliciousAdapter),
      /Invalid providerId/
    );
  });
});
