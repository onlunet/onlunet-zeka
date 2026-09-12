/**
 * ONLUNET ZEKA - FAZ 63 Task Analyzer Suite
 * Validates task understanding, taxonomy, and capability inference
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { analyzeTask, TaskTypes } from '../src/providers/task-analyzer.js';

describe('FAZ 63.7 & 63.8: Intelligent Task Analyzer & Taxonomy', () => {
  it('analyzes coding task and infers STRUCTURED_OUTPUT capability', () => {
    const task = 'Implement a TypeScript function to parse JSON with error handling';
    const analysis = analyzeTask({ task });

    assert.equal(analysis.taskType, TaskTypes.CODING);
    assert.ok(analysis.requiredCapabilities.includes('STRUCTURED_OUTPUT'));
    assert.ok(analysis.requiredCapabilities.includes('TEXT'));
  });

  it('analyzes reasoning task and infers REASONING capability', () => {
    const task = 'Solve this math proof step-by-step to deduce the invariant';
    const analysis = analyzeTask({ task });

    assert.equal(analysis.taskType, TaskTypes.REASONING);
    assert.ok(analysis.requiredCapabilities.includes('REASONING'));
  });

  it('analyzes vision task and infers VISION capability', () => {
    const task = 'Analyze this screenshot and identify UI buttons';
    const analysis = analyzeTask({ task });

    assert.equal(analysis.taskType, TaskTypes.VISION_ANALYSIS);
    assert.ok(analysis.requiredCapabilities.includes('VISION'));
  });
});
