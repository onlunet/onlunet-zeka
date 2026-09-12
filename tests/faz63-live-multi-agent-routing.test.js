/**
 * ONLUNET ZEKA - FAZ 63 Multi-Agent Routing Suite
 * Validates role-based routing across Analysis, Verification, and Synthesis agents
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { createAgentRouter, AgentRoles } from '../src/providers/agent-router.js';

describe('FAZ 63.21 & 63.22: Multi-Agent Live Routing & Policy', () => {
  it('routes multi-agent pipeline with role-specific capabilities while maintaining zero authority', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const modelRegistry = createModelRegistry();
    const routingEngine = createRoutingEngine({ registry, modelRegistry });
    const agentRouter = createAgentRouter({ routingEngine });

    const result = agentRouter.routePipeline({
      roles: [AgentRoles.ANALYSIS, AgentRoles.VERIFICATION, AgentRoles.SYNTHESIS],
      task: 'Perform code review and synthesize security proposal'
    });

    assert.equal(result.totalAgents, 3);
    assert.strictEqual(result.executionAuthorized, false);
    assert.strictEqual(result.proposalOnly, true);

    const [analysis, verification, synthesis] = result.pipeline;
    assert.equal(analysis.agentRole, 'ANALYSIS');
    assert.equal(verification.agentRole, 'VERIFICATION');
    assert.equal(synthesis.agentRole, 'SYNTHESIS');
  });
});
