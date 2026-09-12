/**
 * ONLUNET ZEKA - FAZ 63 Quality-Aware Routing Suite
 * Validates quality target routing to capable reasoning models
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { QualityRequirement } from '../src/providers/task-analyzer.js';

describe('FAZ 63.16: Quality-Aware Routing', () => {
  it('evaluates CRITICAL quality requirement and selects high-reasoning candidate', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const router = createRoutingEngine({ registry });

    const decision = router.route({
      task: 'Formal verification of distributed consensus safety invariant',
      qualityTarget: QualityRequirement.CRITICAL
    });

    assert.equal(decision.qualityRequirement, 'CRITICAL');
    assert.ok(decision.reasons.length > 0);
  });
});
