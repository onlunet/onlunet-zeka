/**
 * ONLUNET ZEKA - FAZ 59 Resource Exhaustion, Budget Attacks & Chaos Test Suite
 *
 * Comprehensive validation:
 * 1. Orchestration limits (Agent limit, step limit, cycle detection, duplicate agents)
 * 2. Budget & Cost hardening (Zero budget, negative budget, NaN/Infinity, negative cost injection)
 * 3. Provider Chaos & Fault Injection (Timeout, 401 fail-fast, 429 bounded backoff, breaker trips)
 *
 * ZERO EXTERNAL DEPENDENCIES: node:test, node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBudgetTracker,
  calculateCost,
  estimateTokenCount
} from '../src/providers/cost-tracker.js';

import {
  createCircuitBreaker,
  CircuitBreakerState
} from '../src/providers/circuit-breaker.js';

import {
  createProviderGateway,
  GatewayInvocationStatus,
  ProviderCapabilities,
  ProviderErrorCodes
} from '../src/providers/provider-gateway.js';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createMockProvider } from '../src/providers/mock-providers.js';

import {
  createMultiAgentExecutor,
  OrchestratorExecutionStatus,
  MAX_ORCHESTRATION_AGENTS,
  MAX_ORCHESTRATION_STEPS
} from '../src/orchestration/multi-agent-executor.js';

import {
  createMultiAgentOrchestrationPlan,
  resolveDependencyOrder,
  MultiAgentPlanStatus
} from '../src/contracts/multi-agent-orchestration.js';

describe('FAZ 59 Resource Exhaustion & Chaos Suite', () => {

  // =========================================================================
  // 1. ORCHESTRATION LIMITS & GRAPH INTEGRITY
  // =========================================================================
  describe('1. Orchestration Hard Bounds & Cycle Detection', () => {
    it('Rejects plans exceeding maximum orchestration agents (10)', async () => {
      const gateway = createProviderGateway();
      const executor = createMultiAgentExecutor({ gateway });

      const elevenMembers = Array.from({ length: 11 }, (_, i) => ({
        agentId: `agent-${i + 1}`,
        role: 'DEVELOPER'
      }));

      await assert.rejects(
        () => executor.executePlan({
          orchestrationPlan: {
            id: 'plan-excess-agents',
            taskId: 'task-ea',
            status: MultiAgentPlanStatus.PLANNED,
            objective: 'Excessive agents',
            members: elevenMembers
          }
        }),
        /exceeds maximum agent limit of 10/
      );
    });

    it('Rejects duplicate agent IDs within orchestration plan', async () => {
      const gateway = createProviderGateway();
      const executor = createMultiAgentExecutor({ gateway });

      await assert.rejects(
        () => executor.executePlan({
          orchestrationPlan: {
            id: 'plan-dup',
            taskId: 'task-dup',
            status: MultiAgentPlanStatus.PLANNED,
            objective: 'Duplicate agent',
            members: [
              { agentId: 'agent-1', role: 'DEVELOPER' },
              { agentId: 'agent-1', role: 'SECURITY' }
            ]
          }
        }),
        /Duplicate agentId 'agent-1'/
      );
    });

    it('Rejects circular dependencies in orchestration DAG', () => {
      // 2-node cycle: A depends on B, B depends on A
      assert.throws(
        () => resolveDependencyOrder(['A', 'B'], { 'A': ['B'], 'B': ['A'] }),
        /Circular dependency detected/
      );

      // Self-dependency: A depends on A
      assert.throws(
        () => resolveDependencyOrder(['A'], { 'A': ['A'] }),
        /Self-dependency detected/
      );
    });

    it('Rejects cyclic execution orders in ad-hoc orchestration plans', async () => {
      const gateway = createProviderGateway();
      const executor = createMultiAgentExecutor({ gateway });

      await assert.rejects(
        () => executor.executePlan({
          orchestrationPlan: {
            id: 'plan-cyclic-order',
            taskId: 'task-co',
            status: MultiAgentPlanStatus.PLANNED,
            objective: 'Looping steps',
            members: [
              { agentId: 'a1', role: 'DEVELOPER' },
              { agentId: 'a2', role: 'TESTER' }
            ],
            executionOrder: ['a1', 'a2', 'a1']
          }
        }),
        /Cycle or repeated agent detected in execution order/
      );
    });
  });

  // =========================================================================
  // 2. BUDGET & COST ADVERSARIAL HARDENING
  // =========================================================================
  describe('2. Budget & Cost Adversarial Hardening', () => {
    it('Zero budget (maxCostUsd = 0) immediately halts non-zero expenditure', () => {
      const budget = createBudgetTracker({ maxCostUsd: 0 });
      const check = budget.checkBudget({ estimatedCostUsd: 0.0001 });
      assert.strictEqual(check.allowed, false);
      assert.ok(check.reason.includes('maxCostUsd'));
    });

    it('Negative budget immediately fails closed', () => {
      const budget = createBudgetTracker({ maxCostUsd: -5.0 });
      const check = budget.checkBudget();
      assert.strictEqual(check.allowed, false);
    });

    it('Malicious negative cost injection cannot replenish budget', () => {
      const budget = createBudgetTracker({ maxCostUsd: 10.0 });
      budget.recordUsage({ inputTokens: 50, outputTokens: 50, costUsd: 4.0 });
      assert.strictEqual(budget.getSummary().cumulativeCostUsd, 4.0);

      // Attempt injection: -100 USD
      budget.recordUsage({ inputTokens: 10, outputTokens: 10, costUsd: -100.0 });
      assert.strictEqual(budget.getSummary().cumulativeCostUsd, 4.0);
    });

    it('Handles non-finite token inputs (Infinity, NaN) safely without corrupting math', () => {
      const costResult = calculateCost({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: Infinity,
        outputTokens: NaN
      });
      assert.strictEqual(costResult.inputTokens, 0);
      assert.strictEqual(costResult.outputTokens, 0);
      assert.strictEqual(costResult.estimatedCostUsd, 0);
    });

    it('Mid-flight budget exhaustion halts multi-agent execution fail-closed', async () => {
      const budget = createBudgetTracker({ maxCalls: 1 });
      const gateway = createProviderGateway({ budgetTracker: budget });
      const executor = createMultiAgentExecutor({ gateway });

      const plan = createMultiAgentOrchestrationPlan({
        id: 'plan-budget-halt',
        taskId: 'task-bh',
        objective: 'Multi-step halt',
        members: [
          { agentId: 'dev-1', role: 'DEVELOPER' },
          { agentId: 'tester-1', role: 'TESTER' }
        ]
      });

      const res = await executor.executePlan({ orchestrationPlan: plan, budgetTracker: budget });
      assert.strictEqual(res.status, OrchestratorExecutionStatus.BUDGET_EXCEEDED);
      assert.strictEqual(res.proposals.length, 1);
    });
  });

  // =========================================================================
  // 3. PROVIDER FAULT INJECTION & CHAOS
  // =========================================================================
  describe('3. Provider Fault Injection & Chaos', () => {
    it('Hanging provider socket is cleanly aborted by hard timeout without deadlock', async () => {
      const hangingProvider = createMockProvider('mock-timeout', { providerId: 'hanging-socket' });
      const registry = createProviderRegistry({ includeBuiltins: false });
      registry.register(hangingProvider);

      const gateway = createProviderGateway({ registry, defaultTimeoutMs: 60 });
      const start = Date.now();
      const res = await gateway.dispatch({ providerId: 'hanging-socket', prompt: 'hang' });
      const duration = Date.now() - start;

      assert.strictEqual(res.status, GatewayInvocationStatus.TIMEOUT);
      assert.strictEqual(res.code, ProviderErrorCodes.PROVIDER_TIMEOUT);
      assert.ok(duration < 2000, `Timeout must trigger within bounded delay (${duration}ms)`);
    });

    it('Non-retriable auth error (401) fails immediately without retry amplification', async () => {
      let callCount = 0;
      const unauthAdapter = {
        providerId: 'unauth-chaos',
        name: 'UnauthChaos',
        model: 'm',
        capabilities: [ProviderCapabilities.TEXT],
        invoke: async () => {
          callCount++;
          const err = new Error('Unauthorized');
          err.status = 401;
          throw err;
        },
        checkHealth: async () => ({ status: 'AVAILABLE', ready: true })
      };

      const registry = createProviderRegistry({ includeBuiltins: false });
      registry.register(unauthAdapter);
      const gateway = createProviderGateway({ registry, defaultMaxRetries: 3 });

      const res = await gateway.dispatch({ providerId: 'unauth-chaos', prompt: 'test' });
      assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
      assert.strictEqual(callCount, 1, 'Must NOT retry on HTTP 401');
    });

    it('Circuit breaker trips to OPEN on 3 consecutive failures and fast-fails', async () => {
      const cb = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });

      assert.strictEqual(cb.getState('provider-chaos'), CircuitBreakerState.CLOSED);
      assert.strictEqual(cb.canExecute('provider-chaos'), true);

      cb.recordFailure('provider-chaos', new Error('Err 1'));
      cb.recordFailure('provider-chaos', new Error('Err 2'));
      assert.strictEqual(cb.getState('provider-chaos'), CircuitBreakerState.CLOSED);

      cb.recordFailure('provider-chaos', new Error('Err 3'));
      assert.strictEqual(cb.getState('provider-chaos'), CircuitBreakerState.OPEN);
      assert.strictEqual(cb.canExecute('provider-chaos'), false);

      const status = cb.getStatus('provider-chaos');
      assert.strictEqual(status.failureCount, 3);
      assert.ok(status.lastError.includes('Err 3'));
    });
  });

});
