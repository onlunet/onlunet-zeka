/**
 * ONLUNET ZEKA - FAZ 65 Tenant Isolation Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createCustomProviderAdapter } from '../src/providers/custom-adapter.js';

describe('FAZ 65.17: Multi-Tenant AI Execution Isolation', () => {
  it('prevents Tenant B from accessing Tenant A private provider', () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const tenantAAdapter = createCustomProviderAdapter({ providerId: 'tenant-a-private' });
    registry.register(tenantAAdapter, { tenantId: 'tenant-A' });

    // Tenant A access succeeds
    assert.ok(registry.getProvider('tenant-a-private', { tenantId: 'tenant-A' }));

    // Tenant B access throws SECURITY_BLOCKED
    assert.throws(() => {
      registry.getProvider('tenant-a-private', { tenantId: 'tenant-B' });
    }, /SECURITY_BLOCKED/);
  });
});
