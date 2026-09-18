import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Structured Output & Schema Verification', () => {
  it('1. Generates JSON formatted request payload with systemInstruction', async () => {
    let capturedBody = null;
    let capturedHeaders = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"rationale": "ok", "operations": []}' }] } }]
        }),
        text: async () => '{"candidates":[]}'
      };
    };

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_ValidFormatKey123' });
      await adapter.invoke({
        prompt: 'Build auth service',
        agentRole: 'ARCHITECT'
      });

      assert.ok(capturedBody.systemInstruction);
      assert.ok(capturedBody.systemInstruction.parts[0].text.includes('ARCHITECT'));
      assert.strictEqual(capturedBody.generationConfig.responseMimeType, 'application/json');
      assert.strictEqual(capturedHeaders['x-goog-api-key'], 'MOCK_GEMINI_KEY_ValidFormatKey123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('2. Gracefully falls back to rationale wrapper on non-JSON raw response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Plain text output without json' }] } }]
      }),
      text: async () => 'plain'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_ValidFormatKey123' });
      const res = await adapter.invoke({ prompt: 'Plain text test' });
      assert.strictEqual(res.rationale, 'Plain text output without json');
      assert.strictEqual(res.proposalOnly, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
