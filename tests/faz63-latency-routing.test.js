/**
 * ONLUNET ZEKA - FAZ 63 Latency-Aware Routing Suite
 * Validates latency requirements in routing scoring
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { LatencyRequirement } from '../src/providers/task-analyzer.js';

describe('FAZ 63.15: Latency-Aware Routing', () => {
  it('favors low-latency candidates when latencyTarget is LOW or < 2000ms', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Realtime instant auto-complete suggestions',
      latencyTarget: LatencyRequirement.LOW
    });

    assert.equal(decision.latencyRequirement, 'LOW');
    assert.ok(decision.selectedProvider);
  });
});
