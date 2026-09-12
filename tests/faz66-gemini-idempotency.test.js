import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAIExecutionPipeline } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 66: Gemini Idempotency & Trace Deduplication', () => {
  it('1. Returns cached response for identical idempotency key', async () => {
    const pipeline = createAIExecutionPipeline();

    const res1 = await pipeline.execute({
      requestId: 'gemini-idem-001',
      task: 'Deterministic calculation 50 + 50',
      preferredProvider: 'local'
    });

    const res2 = await pipeline.execute({
      requestId: 'gemini-idem-001',
      task: 'Deterministic calculation 50 + 50',
      preferredProvider: 'local'
    });

    assert.strictEqual(res2.isDuplicate, true);
    assert.strictEqual(res2.proposalOnly, true);
    assert.strictEqual(res2.executionAuthorized, false);
  });
});
