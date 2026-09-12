/**
 * ONLUNET ZEKA - FAZ 65 Structured Output Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { verifyAIOutput } from '../src/control-plane/ai-execution-pipeline.js';
import { TaskTypes } from '../src/providers/task-analyzer.js';

describe('FAZ 65.7: Structured JSON Output Verification', () => {
  it('validates conforming structured output schema', () => {
    const validOutput = JSON.stringify({
      risk: 'HIGH',
      issues: ['SQL injection detected'],
      recommendation: 'Use parameterized queries'
    });

    const verification = verifyAIOutput({
      content: validOutput,
      taskType: TaskTypes.STRUCTURED_GENERATION,
      expectedSchema: { required: ['risk', 'issues', 'recommendation'] }
    });

    assert.strictEqual(verification.passed, true);
    assert.ok(verification.checks.includes('SCHEMA_CONFORMANCE'));
  });

  it('fails verification on malformed JSON', () => {
    const malformed = '{ risk: HIGH, unquoted: true ';
    const verification = verifyAIOutput({
      content: malformed,
      taskType: TaskTypes.STRUCTURED_GENERATION
    });

    assert.strictEqual(verification.passed, false);
    assert.ok(verification.errors.some(e => e.includes('Invalid JSON output')));
  });
});
