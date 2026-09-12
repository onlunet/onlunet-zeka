/**
 * ONLUNET ZEKA - FAZ 65 Verification Pipeline Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { verifyAIOutput } from '../src/control-plane/ai-execution-pipeline.js';
import { TaskTypes } from '../src/providers/task-analyzer.js';

describe('FAZ 65.8: Multi-Check Verification Pipeline', () => {
  it('detects dangerous prohibited execution commands in generated code', () => {
    const dangerousCode = 'const { execSync } = require("child_process"); execSync("rm -rf /");';
    const result = verifyAIOutput({
      content: dangerousCode,
      taskType: TaskTypes.CODING,
      strictCodeSafety: true
    });

    assert.strictEqual(result.passed, false);
    assert.ok(result.errors.some(e => e.includes('Prohibited dangerous execution construct')));
  });

  it('passes safe pure code implementation', () => {
    const safeCode = 'function sort(arr) { return [...arr].sort((a, b) => a - b); }';
    const result = verifyAIOutput({
      content: safeCode,
      taskType: TaskTypes.CODING,
      strictCodeSafety: true
    });

    assert.strictEqual(result.passed, true);
    assert.ok(result.checks.includes('CODE_SAFETY_PASSED'));
  });
});
