/**
 * ONLUNET ZEKA - FAZ 61 Cost & Idempotency Test Suite
 *
 * Validates:
 * - Multi-tier budget governor (task, workspace, tenant)
 * - Fail-closed halting on budget exhaustion
 * - Exact-once request processing and duplicate suppression
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  createAIControlPlane,
  createCostGovernor,
  createIdempotencyManager
} from '../src/control-plane/index.js';

describe('FAZ 61.11 & 61.12: Cost Governance & Idempotency', () => {

  it('halts operation fail-closed when cost limits are exceeded', () => {
    const governor = createCostGovernor({
      maxPerRequestUsd: 0.05,
      maxPerTaskUsd: 0.05
    });

    // Check pre-flight within budget
    const okCheck = governor.checkBudget({ estimatedCostUsd: 0.01, taskId: 'task-c1' });
    assert.strictEqual(okCheck.allowed, true);

    // Exceed single task limit
    const exceededCheck = governor.checkBudget({ estimatedCostUsd: 0.10, taskId: 'task-c1' });
    assert.strictEqual(exceededCheck.allowed, false);
    assert.ok(exceededCheck.reason.includes('exceeds'));
  });

  it('zero and negative budgets immediately fail closed', () => {
    const zeroGov = createCostGovernor({ maxPerRequestUsd: 0 });
    assert.strictEqual(zeroGov.checkBudget({ estimatedCostUsd: 0.01 }).allowed, false);

    const negGov = createCostGovernor({ maxPerRequestUsd: -5 });
    assert.strictEqual(negGov.checkBudget({ estimatedCostUsd: 0.01 }).allowed, false);
  });

  it('suppresses duplicate execution and billing via idempotency manager', () => {
    const idempotency = createIdempotencyManager();
    const key = 'idem-test-key-61-alpha';

    // First acquisition: not duplicate, acquired is true
    const acq1 = idempotency.acquire(key);
    assert.strictEqual(acq1.acquired, true);

    // Commit result
    const resultObj = { status: 'SUCCESS', output: 'Processed once' };
    idempotency.commit(key, resultObj);

    // Second acquisition: duplicate detected, returns cached result
    const acq2 = idempotency.acquire(key);
    assert.strictEqual(acq2.duplicate, true);
    assert.deepEqual(acq2.cachedResult, resultObj);
  });

  it('end-to-end control plane dispatch prevents duplicate execution on identical idempotency key', async () => {
    const controlPlane = createAIControlPlane();
    const idemKey = 'idem-e2e-unique-key-1';

    const firstRes = await controlPlane.executeDispatch({
      prompt: 'Execute idempotent calculation',
      idempotencyKey: idemKey
    });
    assert.equal(firstRes.status, 'SUCCESS');
    assert.ok(!firstRes.isDuplicate);

    const secondRes = await controlPlane.executeDispatch({
      prompt: 'Execute idempotent calculation',
      idempotencyKey: idemKey
    });
    assert.equal(secondRes.status, 'SUCCESS');
    assert.strictEqual(secondRes.isDuplicate, true);
    assert.strictEqual(secondRes.cached, true);
  });
});
