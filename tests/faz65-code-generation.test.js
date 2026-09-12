/**
 * ONLUNET ZEKA - FAZ 65 Code Generation Task Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, AIExecutionStatus } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.5: Code Generation Pipeline & Safety Inspection', () => {
  it('generates array sort function as proposalOnly without executing code', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: "Bir JavaScript fonksiyonu yaz: Bir sayı dizisini küçükten büyüğe sıralasın.",
      preferredProvider: 'local'
    });

    assert.strictEqual(contract.status, AIExecutionStatus.COMPLETED);
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
    assert.strictEqual(contract.mutationAuthorized, false);
    assert.ok(contract.verification.checks.includes('CODE_SAFETY_PASSED'));
  });
});
