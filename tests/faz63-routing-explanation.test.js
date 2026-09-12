/**
 * ONLUNET ZEKA - FAZ 63 Routing Explanation Suite
 * Validates explainability of routing decisions and candidate rejections
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';

describe('FAZ 63.19: Routing Explanation & Auditability', () => {
  it('explains reasons for selection and logs rejected candidates with reasons', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Build a secure REST API in Node.js',
      preferredProvider: 'local'
    });

    assert.ok(decision.reasons.length > 0);
    assert.ok(Array.isArray(decision.rejectedCandidates));
    // Zero secret leakage in reasons
    const serialized = JSON.stringify(decision.reasons);
    assert.ok(!serialized.includes('Bearer'));
    assert.ok(!serialized.includes('apiKey'));
  });
});
