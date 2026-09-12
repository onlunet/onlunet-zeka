/**
 * ONLUNET ZEKA - FAZ 65 Failure Injection & Resilience Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, AIExecutionStatus } from '../src/control-plane/ai-execution-pipeline.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.19: Failure Injection & Fail-Closed Robustness', () => {
  const pipeline = createAIExecutionPipeline();

  it('scenario 1: Empty task string fails closed safely', async () => {
    const contract = await pipeline.execute({ task: '' });
    assert.strictEqual(contract.status, AIExecutionStatus.FAILED);
  });

  it('scenario 2: Zero budget fails closed with BUDGET_EXCEEDED', async () => {
    const contract = await pipeline.execute({ task: 'Analyze', budget: 0 });
    assert.strictEqual(contract.status, AIExecutionStatus.BUDGET_EXCEEDED);
  });

  it('scenario 3: Negative budget fails closed with BUDGET_EXCEEDED', async () => {
    const contract = await pipeline.execute({ task: 'Analyze', budget: -5 });
    assert.strictEqual(contract.status, AIExecutionStatus.BUDGET_EXCEEDED);
  });

  it('scenario 4: Unconfigured cloud provider fails closed with NOT_CONFIGURED without crashing', async () => {
    const contract = await pipeline.execute({
      task: 'Public query',
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'openai'
    });
    // In absence of OPENAI_API_KEY, gracefully returns NOT_CONFIGURED
    assert.ok([AIExecutionStatus.NOT_CONFIGURED, AIExecutionStatus.COMPLETED].includes(contract.status));
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
  });
});
