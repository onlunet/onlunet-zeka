/**
 * ONLUNET ZEKA - FAZ 65 Budget Enforcement Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, AIExecutionStatus } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.15: Hard Budget Enforcement', () => {
  it('fails closed immediately with BUDGET_EXCEEDED when budget is zero or negative', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: 'Calculate complex statistics',
      budget: 0,
      preferredProvider: 'openai'
    });

    assert.strictEqual(contract.status, AIExecutionStatus.BUDGET_EXCEEDED);
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
  });
});
