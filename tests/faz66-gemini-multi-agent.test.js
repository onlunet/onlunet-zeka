import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAgentRouter, AgentRoles } from '../src/providers/agent-router.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 66: Gemini Multi-Agent Orchestration & Pipeline Routing', () => {
  const registry = createProviderRegistry({ includeBuiltins: true });
  const router = createRoutingEngine({ registry });
  const agentRouter = createAgentRouter({ routingEngine: router });

  it('routes multi-agent team with Gemini capability integration & zero authority', () => {
    const pipeline = agentRouter.routePipeline({
      roles: [AgentRoles.ANALYSIS, AgentRoles.SYNTHESIS],
      task: 'Analyze system scalability with Gemini architecture',
      dataClassification: DataClassification.PUBLIC
    });

    assert.strictEqual(pipeline.totalAgents, 2);
    assert.strictEqual(pipeline.proposalOnly, true);
    assert.strictEqual(pipeline.executionAuthorized, false);

    for (const step of pipeline.pipeline) {
      assert.strictEqual(step.proposalOnly, true);
      assert.strictEqual(step.executionAuthorized, false);
      assert.ok(step.routingDecision.selectedProvider);
    }
  });
});
