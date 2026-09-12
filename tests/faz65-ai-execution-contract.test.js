/**
 * ONLUNET ZEKA - FAZ 65 AI Execution Contract Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionContract, AIExecutionStatus, AILifecycleState } from '../src/control-plane/ai-execution-pipeline.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.1: Canonical AI Execution Contract', () => {
  it('creates an immutable, versioned AI execution contract with zero authority guarantees', () => {
    const contract = createAIExecutionContract({
      requestId: 'req-contract-001',
      traceId: 'trc-001',
      tenantId: 'tenant-enterprise',
      workspaceId: 'ws-main',
      task: 'Analyze code quality',
      taskType: 'CODING',
      classification: DataClassification.PUBLIC,
      selectedProvider: 'local',
      selectedModel: 'local-deterministic-v1',
      status: AIExecutionStatus.COMPLETED,
      response: { content: 'function add(a, b) { return a + b; }' },
      verification: { passed: true, checks: ['SYNTAX_OK'] },
      latencyMs: 12
    });

    assert.strictEqual(contract.contractVersion, '1.0.0');
    assert.strictEqual(contract.requestId, 'req-contract-001');
    assert.strictEqual(contract.tenantId, 'tenant-enterprise');
    assert.strictEqual(contract.taskType, 'CODING');
    assert.strictEqual(contract.status, AIExecutionStatus.COMPLETED);

    // Hard Invariants
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
    assert.strictEqual(contract.mutationAuthorized, false);
    assert.strictEqual(contract.approvalGranted, false);
    assert.strictEqual(contract.admissionGranted, false);
    assert.strictEqual(contract.verificationPassed, true);

    // Immutability
    assert.throws(() => {
      contract.executionAuthorized = true;
    });
  });
});
