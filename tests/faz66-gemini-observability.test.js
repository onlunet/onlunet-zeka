import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Observability & Audit Telemetry', () => {
  it('1. Output contains latencyMs, usage tokens, and cost breakdown', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"rationale":"metrics test"}' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
      }),
      text: async () => '{}'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyTestKey' });
      const res = await adapter.invoke({ prompt: 'Telemetry test' });

      assert.strictEqual(typeof res.latencyMs, 'number');
      assert.ok(res.latencyMs >= 0);
      assert.strictEqual(res.usage.totalTokens, 30);
      assert.strictEqual(typeof res.cost.estimatedCostUsd, 'number');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
