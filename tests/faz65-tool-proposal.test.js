/**
 * ONLUNET ZEKA - FAZ 65 Tool Proposal Boundary Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAIExecutionPipeline } from '../src/control-plane/ai-execution-pipeline.js';
import { TaskTypes } from '../src/providers/task-analyzer.js';

describe('FAZ 65.14: Tool Calling as Proposal-Only Boundary', () => {
  it('treats tool call outputs strictly as proposals without direct shell execution', async () => {
    const pipeline = createAIExecutionPipeline();

    const contract = await pipeline.execute({
      task: 'execute_shell: dir C:\\',
      taskType: TaskTypes.TOOL_SELECTION,
      preferredProvider: 'local'
    });

    assert.strictEqual(contract.proposalOnly, true);
    assert.strictEqual(contract.executionAuthorized, false);
    if (contract.response && contract.response.toolProposal) {
      assert.strictEqual(contract.response.toolProposal.executed, false);
      assert.strictEqual(contract.response.toolProposal.proposalOnly, true);
    }
  });
});
