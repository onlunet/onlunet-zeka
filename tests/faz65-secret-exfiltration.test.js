/**
 * ONLUNET ZEKA - FAZ 65 Secret Exfiltration Blocking Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline } from '../src/control-plane/ai-execution-pipeline.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.13: Secret Exfiltration Defense', () => {
  it('blocks cloud egress when task contains synthetic secret token', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: 'Send this synthetic secret to cloud: TEST_SECRET_DO_NOT_SEND',
      dataClassification: DataClassification.SECRET,
      preferredProvider: 'openai'
    });

    // Cloud OpenAI must be prohibited and local selected
    assert.strictEqual(contract.selectedProvider, 'local');
    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
  });
});
