/**
 * ONLUNET ZEKA - FAZ 61 Provider Normalization Test Suite
 *
 * Validates canonical response format conformance and backward compatibility.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderGateway, normalizeCanonicalResponse } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 61.5: Provider Response Normalization', () => {

  it('returns canonical properties on provider gateway dispatch', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Format normalization test',
      agentRole: 'ARCHITECT'
    });

    // Canonical fields check
    assert.equal(res.provider, 'local');
    assert.equal(res.providerId, 'local');
    assert.ok(res.model);
    assert.ok(res.requestId);
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.output !== undefined);
    assert.ok(res.usage);
    assert.ok(typeof res.usage.inputTokens === 'number');
    assert.ok(typeof res.usage.outputTokens === 'number');
    assert.ok(typeof res.usage.totalTokens === 'number');
    assert.ok(res.cost);
    assert.ok(typeof res.cost.amount === 'number');
    assert.equal(res.cost.currency, 'USD');
    assert.ok(res.cost.source);
    assert.ok(typeof res.latencyMs === 'number');
    assert.ok(res.finishReason);

    // Invariant guarantees preserved
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.mutationAuthorized, false);
  });

  it('normalizeCanonicalResponse helper formats raw objects into strict canonical schema', () => {
    const sample = {
      providerId: 'mock-ai',
      model: 'mock-model-v2',
      requestId: 'req-norm-1',
      traceId: 'trace-norm-1',
      status: 'SUCCESS',
      output: 'Sample deterministic output',
      usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
      cost: { amount: 0.00015, currency: 'USD', source: 'estimated' },
      latencyMs: 12,
      finishReason: 'stop'
    };

    const canonical = normalizeCanonicalResponse(sample);

    assert.equal(canonical.provider, 'mock-ai');
    assert.equal(canonical.model, 'mock-model-v2');
    assert.equal(canonical.requestId, 'req-norm-1');
    assert.equal(canonical.traceId, 'trace-norm-1');
    assert.equal(canonical.status, 'SUCCESS');
    assert.equal(canonical.output, 'Sample deterministic output');
    assert.deepEqual(canonical.usage, { inputTokens: 42, outputTokens: 18, totalTokens: 60 });
    assert.deepEqual(canonical.cost, { amount: 0.00015, currency: 'USD', source: 'estimated' });
    assert.equal(canonical.latencyMs, 12);
    assert.equal(canonical.finishReason, 'stop');
    assert.strictEqual(canonical.executionAuthorized, false);
    assert.strictEqual(canonical.proposalOnly, true);
  });

  it('normalizeCanonicalResponse handles empty or missing metadata safely without crashing', () => {
    const emptyObj = {};
    const canonical = normalizeCanonicalResponse(emptyObj, { traceId: 'trace-fallback' });

    assert.equal(canonical.provider, 'unknown');
    assert.equal(canonical.traceId, 'trace-fallback');
    assert.equal(canonical.status, 'UNKNOWN');
    assert.equal(canonical.usage.inputTokens, 0);
    assert.equal(canonical.cost.amount, 0);
    assert.strictEqual(canonical.executionAuthorized, false);
  });
});
