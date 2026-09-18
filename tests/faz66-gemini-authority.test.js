import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Zero-Authority Invariant Gate', () => {
  it('1. AI != Authority: Gemini outputs cannot directly execute side-effects', async () => {
    const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_TestKey' });
    assert.strictEqual(typeof adapter.execute, 'undefined', 'Adapter must not provide an execute() method');
    assert.strictEqual(typeof adapter.runCommand, 'undefined', 'Adapter must not run commands');
    assert.strictEqual(typeof adapter.writeFile, 'undefined', 'Adapter must not write files');
  });

  it('2. Returned proposals require authoritative review pipeline', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"rationale":"proposal test","operations":[]}' }] } }]
      }),
      text: async () => '{}'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_TestKey' });
      const res = await adapter.invoke({ prompt: 'Refactor code' });
      assert.strictEqual(res.proposalOnly, true);
      assert.strictEqual(res.executionAuthorized, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
