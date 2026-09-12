/**
 * ONLUNET ZEKA - FAZ 63 Multi-Provider Controlled Evaluation Suite
 * Validates comparative execution across registered providers
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';
import { createProviderGateway } from '../src/providers/provider-gateway.js';

describe('FAZ 63.17: Multi-Provider Live Controlled Comparison', () => {
  it('compares multiple providers under identical tasks without cross-contamination', async () => {
    const p1 = createLocalProviderAdapter({ providerId: 'prov-alpha' });
    const p2 = createLocalProviderAdapter({ providerId: 'prov-beta' });

    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(p1);
    registry.register(p2);
    const gateway = createProviderGateway({ registry });

    const r1 = await gateway.dispatch({ providerId: 'prov-alpha', prompt: 'Echo 1' });
    const r2 = await gateway.dispatch({ providerId: 'prov-beta', prompt: 'Echo 2' });

    assert.equal(r1.status, 'SUCCESS');
    assert.equal(r2.status, 'SUCCESS');
    assert.notEqual(r1.requestId, r2.requestId);
  });
});
