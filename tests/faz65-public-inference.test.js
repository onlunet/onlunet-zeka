/**
 * ONLUNET ZEKA - FAZ 65 Public Inference Pipeline Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, AIExecutionStatus } from '../src/control-plane/ai-execution-pipeline.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.4: End-to-End Public Task Execution', () => {
  it('executes e-commerce summary task via local provider with full verification & proposal-only output', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: "Bir e-ticaret sitesi için ürün açıklamasını üç maddede özetle.",
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'local'
    });

    assert.strictEqual(contract.status, AIExecutionStatus.COMPLETED);
    assert.strictEqual(contract.selectedProvider, 'local');
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
    assert.ok(contract.response && contract.response.content);
    assert.ok(contract.verification && contract.verification.passed);
  });
});
