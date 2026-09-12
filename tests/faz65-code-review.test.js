/**
 * ONLUNET ZEKA - FAZ 65 Code Review Task Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, AIExecutionStatus } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.6: Code Review Pipeline with Advisory-Only Invariant', () => {
  it('performs security review of SQL concatenation without database connection or side effects', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: 'function getUser(id) { return db.query("SELECT * FROM users WHERE id=" + id); } Review code for security vulnerabilities.',
      preferredProvider: 'local'
    });

    assert.strictEqual(contract.status, AIExecutionStatus.COMPLETED);
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
    assert.ok(contract.verification.checks.includes('REVIEW_ADVISORY_CONFIRMED'));
  });
});
