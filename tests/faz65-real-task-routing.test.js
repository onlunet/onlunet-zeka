/**
 * ONLUNET ZEKA - FAZ 65 Real-World Task Routing Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { analyzeTask, TaskTypes } from '../src/providers/task-analyzer.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createRoutingEngine } from '../src/providers/routing-engine.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 65.3: Real-World Task Analysis & Intelligent Routing', () => {
  const registry = createProviderRegistry({ includeBuiltins: true });
  const router = createRoutingEngine({ registry });

  it('identifies GENERAL_QA: Türkiye\'nin başkenti nedir?', () => {
    const analysis = analyzeTask({ task: "Türkiye'nin başkenti nedir?" });
    assert.strictEqual(analysis.taskType, TaskTypes.GENERAL_QA);
  });

  it('identifies CODING: JavaScript array max function', () => {
    const analysis = analyzeTask({ task: "JavaScript'te bir array içindeki en büyük sayıyı bulan fonksiyon yaz." });
    assert.strictEqual(analysis.taskType, TaskTypes.CODING);
  });

  it('identifies CODE_REVIEW: Security audit inspection', () => {
    const analysis = analyzeTask({ task: "Bu fonksiyonda güvenlik problemi var mı? inspect code review." });
    assert.strictEqual(analysis.taskType, TaskTypes.CODE_REVIEW);
  });

  it('identifies REASONING: Compare project costs and risks', () => {
    const analysis = analyzeTask({ task: "Bir projenin maliyet ve risklerini karşılaştır, adım adım çöz." });
    assert.strictEqual(analysis.taskType, TaskTypes.REASONING);
  });

  it('identifies STRUCTURED_GENERATION: Output JSON schema', () => {
    const analysis = analyzeTask({ task: "Return JSON object with schema for user registration" });
    assert.strictEqual(analysis.taskType, TaskTypes.STRUCTURED_GENERATION);
  });

  it('enforces SECRET confinement to local provider', () => {
    const decision = router.route({
      task: "Process confidential database passwords",
      dataClassification: DataClassification.SECRET,
      preferredProvider: 'openai'
    });
    assert.strictEqual(decision.selectedProvider, 'local');
    assert.ok(decision.rejectedCandidates.some(r => r.provider === 'openai'));
  });
});
