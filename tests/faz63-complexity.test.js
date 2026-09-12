/**
 * ONLUNET ZEKA - FAZ 63 Complexity Scoring Suite
 * Validates deterministic complexity scoring
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { analyzeTask, TaskComplexity } from '../src/providers/task-analyzer.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 63.9: Deterministic Complexity Scoring', () => {
  it('assigns LOW complexity to short simple QA task', () => {
    const analysis = analyzeTask({ task: 'What is HTTP?' });
    assert.equal(analysis.complexity, TaskComplexity.LOW);
  });

  it('escalates to HIGH or CRITICAL complexity for multi-faceted reasoning and restricted data', () => {
    const task = 'Deduce step-by-step mathematical proof of safety invariants for this core security engine '.repeat(20);
    const analysis = analyzeTask({
      task,
      dataClassification: DataClassification.RESTRICTED
    });

    assert.ok([TaskComplexity.HIGH, TaskComplexity.CRITICAL].includes(analysis.complexity));
  });
});
