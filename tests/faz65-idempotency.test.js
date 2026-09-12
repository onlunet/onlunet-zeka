/**
 * ONLUNET ZEKA - FAZ 65 Idempotency Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.16: Idempotent Execution & Duplicate Suppression', () => {
  it('returns cached result on duplicate execution request with identical key', async () => {
    const pipeline = createAIExecutionPipeline();

    const res1 = await pipeline.execute({
      requestId: 'req-idem-001',
      task: 'Deterministic calculation 42 + 42',
      preferredProvider: 'local'
    });

    const res2 = await pipeline.execute({
      requestId: 'req-idem-001',
      task: 'Deterministic calculation 42 + 42',
      preferredProvider: 'local'
    });

    assert.strictEqual(res2.isDuplicate, true);
    assert.strictEqual(res2.proposalOnly, true);
    assert.strictEqual(res2.executionAuthorized, false);
  });
});
