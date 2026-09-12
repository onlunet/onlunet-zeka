/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Multi-Tenant Isolation Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 64.12: Multi-Tenant Provider Isolation', () => {
  it('blocks Tenant B from accessing Tenant A private custom provider fail-closed', () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register({ providerId: 'openai-tenant-a', invoke: async () => ({}) }, { tenantId: 'tenant-a' });

    assert.throws(
      () => registry.getProvider('openai-tenant-a', { tenantId: 'tenant-b' }),
      /SECURITY_BLOCKED/
    );
  });
});
