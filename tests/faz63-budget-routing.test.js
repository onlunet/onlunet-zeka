/**
 * ONLUNET ZEKA - FAZ 63 Budget-Aware Routing Suite
 * Validates budget hard gate and cost-sensitive candidate scoring
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';

describe('FAZ 63.14: Budget-Aware Routing & Cost Guardrails', () => {
  it('blocks invocation fail-closed when budget is 0 or negative', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    assert.throws(() => {
      router.route({
        task: 'General query',
        budget: 0
      });
    }, /BUDGET_EXCEEDED|SECURITY_BLOCKED/);
  });

  it('selects cost-effective provider under tight budget', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Fast batch summarization',
      budget: 0.005
    });

    assert.ok(decision.selectedProvider);
    assert.equal(decision.costSensitivity, 'HIGH');
  });
});
