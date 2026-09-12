/**
 * ONLUNET ZEKA - FAZ 65 Bounded Self-Correction Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline, DEFAULT_MAX_CORRECTION_CYCLES } from '../src/control-plane/ai-execution-pipeline.js';

describe('FAZ 65.9: Bounded Self-Correction Lifecycle', () => {
  it('enforces hard upper bound of 3 correction cycles without infinite loops', async () => {
    const pipeline = createAIExecutionPipeline({
      maxCorrectionCycles: 3
    });

    // Request with impossible schema requirement to trigger correction bound
    const contract = await pipeline.execute({
      task: 'Generate output',
      expectedSchema: { required: ['impossible_key_never_generated_by_mock'] },
      preferredProvider: 'local'
    });

    assert.ok(contract.selfCorrection);
    assert.strictEqual(contract.selfCorrection.maxAllowed, 3);
    assert.strictEqual(contract.selfCorrection.bounded, true);
    assert.ok(contract.selfCorrection.cyclesAttempted <= 4);
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
  });
});
