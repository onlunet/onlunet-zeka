import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Tenant & Workspace Isolation', () => {
  it('1. Enforces tenant barrier on custom Gemini adapter registration', () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(createGeminiProviderAdapter({ providerId: 'gemini-tenant-a' }), {
      tenantId: 'tenant-alpha'
    });

    const adapterA = registry.getProvider('gemini-tenant-a', { tenantId: 'tenant-alpha' });
    assert.ok(adapterA);

    assert.throws(() => {
      registry.getProvider('gemini-tenant-a', { tenantId: 'tenant-bravo' });
    }, /SECURITY_BLOCKED/);
  });
});
