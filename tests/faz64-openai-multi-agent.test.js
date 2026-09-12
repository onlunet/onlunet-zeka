/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Multi-Agent Routing Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { createAgentRouter, AgentRoles } from '../src/providers/agent-router.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 64.16: Multi-Agent Live Routing with OpenAI', () => {
  it('routes multi-agent pipeline preserving zero authority across all steps', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const routingEngine = createRoutingEngine({ registry });
    const agentRouter = createAgentRouter({ routingEngine });

    const res = agentRouter.routePipeline({
      roles: [AgentRoles.ANALYSIS, AgentRoles.VERIFICATION, AgentRoles.SYNTHESIS],
      task: 'Analyze code and synthesize review',
      dataClassification: DataClassification.PUBLIC
    });

    assert.equal(res.totalAgents, 3);
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.proposalOnly, true);
  });
});
