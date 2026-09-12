/**
 * ONLUNET ZEKA - FAZ 65 Multi-Agent Execution Pipeline Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAgentRouter, AgentRoles } from '../src/providers/agent-router.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.10: Multi-Agent Orchestration & Authority Isolation', () => {
  const registry = createProviderRegistry({ includeBuiltins: true });
  const router = createRoutingEngine({ registry });
  const agentRouter = createAgentRouter({ routingEngine: router });

  it('routes 3-agent pipeline (ANALYSIS -> VERIFICATION -> SYNTHESIS) with zero authority per agent', () => {
    const pipeline = agentRouter.routePipeline({
      roles: [AgentRoles.ANALYSIS, AgentRoles.VERIFICATION, AgentRoles.SYNTHESIS],
      task: 'Bir yazılım projesinin güvenlik risklerini analiz et.',
      dataClassification: DataClassification.PUBLIC
    });

    assert.strictEqual(pipeline.totalAgents, 3);
    assert.strictEqual(pipeline.proposalOnly, true);
    assert.strictEqual(pipeline.executionAuthorized, false);

    for (const step of pipeline.pipeline) {
      assert.strictEqual(step.proposalOnly, true);
      assert.strictEqual(step.executionAuthorized, false);
      assert.ok(step.routingDecision.selectedProvider);
    }
  });
});
