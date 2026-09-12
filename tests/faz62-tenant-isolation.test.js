/**
 * ONLUNET ZEKA - FAZ 62 Multi-Tenant Provider Isolation Suite
 * Validates tenant-scoped provider access and cross-tenant blocking
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';

describe('FAZ 62.19: Multi-Tenant Provider Isolation', () => {
  it('blocks Tenant B from accessing Tenant A private custom provider fail-closed', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });

    const privateAdapter = createLocalProviderAdapter({
      providerId: 'tenant-a-private-llm'
    });

    registry.register(privateAdapter, { tenantId: 'tenant-alpha' });

    // Tenant Alpha access succeeds
    const alphaAdapter = registry.getProvider('tenant-a-private-llm', { tenantId: 'tenant-alpha' });
    assert.ok(alphaAdapter);

    // Tenant Beta access must throw SECURITY_BLOCKED
    assert.throws(
      () => registry.getProvider('tenant-a-private-llm', { tenantId: 'tenant-beta' }),
      /SECURITY_BLOCKED/
    );
  });
});
