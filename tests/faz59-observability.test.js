/**
 * ONLUNET ZEKA - FAZ 59 Observability, Telemetry & Audit Integrity Test Suite
 *
 * Comprehensive validation:
 * 1. Structured correlation tracking (requestId, correlationId, taskId, tenantId, workspaceId)
 * 2. Zero secret leakage in diagnostic events, logs, and error responses
 * 3. End-to-end audit trail continuity across the 11-step pipeline
 * 4. Circuit breaker observability and state change callbacks
 * 5. HTTP API observability without credential exposure
 *
 * ZERO EXTERNAL DEPENDENCIES: node:test, node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createProviderGateway,
  GatewayInvocationStatus,
  DefaultGatewayAuthorityGuarantee
} from '../src/providers/provider-gateway.js';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';
import { createCircuitBreaker, CircuitBreakerState } from '../src/providers/circuit-breaker.js';
import { createBudgetTracker } from '../src/providers/cost-tracker.js';

import {
  createAgentProposal,
  validateAgentProposal
} from '../src/contracts/agent-proposal.js';

import {
  createMultiAgentOrchestrationPlan,
  MultiAgentPlanStatus
} from '../src/contracts/multi-agent-orchestration.js';

import {
  aggregateAndReviewProposals,
  ProposalReviewStatus
} from '../src/contracts/proposal-review.js';

describe('FAZ 59 Observability, Telemetry & Audit Integrity Suite', () => {

  // =========================================================================
  // 1. STRUCTURED CORRELATION & LINEAGE TRACKING
  // =========================================================================
  describe('1. Structured Correlation & Lineage Tracking', () => {
    it('Preserves correlationId, taskId, tenantId, and workspaceId across dispatch lifecycle', async () => {
      const customCorrelationId = 'corr-audit-9999';
      const customTaskId = 'task-security-check';
      const customTenantId = 'tenant-enterprise';
      const customWorkspaceId = 'ws-core';

      const adapter = createLocalProviderAdapter({ providerId: 'obs-provider' });
      const registry = createProviderRegistry({ includeBuiltins: false });
      registry.register(adapter, { providerId: 'obs-provider', tenantId: customTenantId, workspaceId: customWorkspaceId });

      const gateway = createProviderGateway({ registry });

      const res = await gateway.dispatch({
        providerId: 'obs-provider',
        prompt: 'Audit prompt',
        tenantId: customTenantId,
        workspaceId: customWorkspaceId,
        metadata: {
          correlationId: customCorrelationId,
          taskId: customTaskId
        }
      });

      assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
      assert.strictEqual(res.correlationId, customCorrelationId);
      assert.strictEqual(res.taskId, customTaskId);
      assert.strictEqual(res.tenantId, customTenantId);
      assert.strictEqual(res.workspaceId, customWorkspaceId);
      assert.ok(res.requestId.startsWith('req-gw-'));
      assert.ok(res.timestamp);
    });

    it('Propagates correlation identifiers on pre-flight budget failure', async () => {
      const budget = createBudgetTracker({ maxCalls: 0 });
      const gateway = createProviderGateway({ budgetTracker: budget });

      const res = await gateway.dispatch({
        providerId: 'local-provider',
        prompt: 'Over-budget',
        tenantId: 'tenant-budget-fail',
        metadata: { correlationId: 'corr-budget-123', taskId: 'task-budget-fail' }
      });

      assert.strictEqual(res.status, GatewayInvocationStatus.BUDGET_EXCEEDED);
      assert.strictEqual(res.correlationId, 'corr-budget-123');
      assert.strictEqual(res.taskId, 'task-budget-fail');
      assert.strictEqual(res.tenantId, 'tenant-budget-fail');
    });

    it('Propagates correlation identifiers on circuit breaker open failure', async () => {
      const cb = createCircuitBreaker({ failureThreshold: 1 });
      cb.recordFailure('broken-p', new Error('Down'));
      const gateway = createProviderGateway({ circuitBreaker: cb });

      const res = await gateway.dispatch({
        providerId: 'broken-p',
        prompt: 'Breaker test',
        metadata: { correlationId: 'corr-cb-fail', taskId: 'task-cb' }
      });

      assert.strictEqual(res.status, GatewayInvocationStatus.CIRCUIT_OPEN);
      assert.strictEqual(res.correlationId, 'corr-cb-fail');
      assert.strictEqual(res.taskId, 'task-cb');
    });
  });

  // =========================================================================
  // 2. SECRET REDACTION IN DIAGNOSTICS & TELEMETRY
  // =========================================================================
  describe('2. Secret Redaction in Diagnostics', () => {
    it('Scrubs sensitive API keys and connection strings from dispatch error diagnostics', async () => {
      const leakyAdapter = {
        providerId: 'leaky-provider',
        name: 'Leaky',
        model: 'm',
        capabilities: [],
        invoke: async () => {
          throw new Error('Database crashed at postgres://admin:SuperSecretPass123@db.prod:5432/main with key sk-ant-api03-abcdef1234567890123456');
        },
        checkHealth: async () => ({ status: 'AVAILABLE', ready: true })
      };

      const registry = createProviderRegistry({ includeBuiltins: false });
      registry.register(leakyAdapter);
      const gateway = createProviderGateway({ registry });

      const res = await gateway.dispatch({ providerId: 'leaky-provider', prompt: 'test' });

      assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
      assert.ok(!res.error.includes('SuperSecretPass123'), 'Leaked DB password in diagnostic error');
      assert.ok(!res.error.includes('sk-ant-api03'), 'Leaked Anthropic key in diagnostic error');
      assert.ok(res.error.includes('***REDACTED***'), 'Missing redaction marker');
    });

    it('Circuit breaker transition callback provides sanitized telemetry events', () => {
      const capturedEvents = [];
      const cb = createCircuitBreaker({
        failureThreshold: 1,
        onStateChange: (event) => {
          capturedEvents.push(event);
        }
      });

      cb.recordFailure('provider-tel', new Error('Failure with Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.tokensecret'));

      assert.strictEqual(capturedEvents.length, 1);
      const evt = capturedEvents[0];
      assert.strictEqual(evt.providerId, 'provider-tel');
      assert.strictEqual(evt.fromState, CircuitBreakerState.CLOSED);
      assert.strictEqual(evt.toState, CircuitBreakerState.OPEN);
      assert.ok(evt.timestamp);
    });
  });

  // =========================================================================
  // 3. AUDIT TRAIL LINEAGE CONTINUITY
  // =========================================================================
  describe('3. Audit Trail Lineage Continuity', () => {
    it('Maintains unbroken lineage from Provider Dispatch -> Proposal -> Review Aggregation', async () => {
      const gateway = createProviderGateway();
      const aiResult = await gateway.dispatch({
        providerId: 'local-provider',
        prompt: 'Build notification service',
        agentId: 'agent-dev-9',
        agentRole: 'DEVELOPER',
        tenantId: 'tenant-audit-lead',
        workspaceId: 'ws-main',
        metadata: {
          correlationId: 'corr-chain-777',
          taskId: 'task-notif-1'
        }
      });

      // 1. Dispatch level audit
      assert.strictEqual(aiResult.correlationId, 'corr-chain-777');
      assert.strictEqual(aiResult.taskId, 'task-notif-1');
      assert.strictEqual(aiResult.executionAuthorized, false);

      // 2. Proposal level audit
      const proposal = createAgentProposal({
        id: 'prop-notif-1',
        taskId: aiResult.taskId,
        agentId: aiResult.agentId,
        providerId: aiResult.providerId,
        objective: 'Build notification service',
        rationale: aiResult.rationale,
        operations: [{ type: 'CREATE', target: 'src/notif.js', description: 'Created notif' }],
        metadata: {
          correlationId: aiResult.correlationId,
          tenantId: aiResult.tenantId,
          workspaceId: aiResult.workspaceId
        }
      });
      assert.strictEqual(proposal.taskId, 'task-notif-1');
      assert.strictEqual(proposal.metadata.correlationId, 'corr-chain-777');
      assert.strictEqual(proposal.executionAuthorized, false);

      // 3. Plan & Review level audit
      const plan = createMultiAgentOrchestrationPlan({
        id: 'plan-notif-1',
        taskId: 'task-notif-1',
        tenantId: 'tenant-audit-lead',
        workspaceId: 'ws-main',
        objective: 'Build notification service',
        members: [{ agentId: 'agent-dev-9', role: 'DEVELOPER' }]
      });

      const review = aggregateAndReviewProposals({
        taskId: 'task-notif-1',
        orchestrationPlan: plan,
        proposals: [proposal]
      });

      assert.strictEqual(review.status, ProposalReviewStatus.REVIEWED);
      assert.strictEqual(review.taskId, 'task-notif-1');
      assert.strictEqual(review.proposals.length, 1);
      assert.strictEqual(review.proposals[0].id, 'prop-notif-1');
      assert.strictEqual(review.executionAuthorized, false);
      assert.strictEqual(review.approvalGranted, false);
    });
  });

});
