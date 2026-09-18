import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Tool Proposal Boundary', () => {
  it('1. Operations are declarative descriptions, not executable callbacks', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    rationale: 'Add logger',
                    operations: [
                      { type: 'CREATE_FILE', target: 'logger.js', description: 'create logger utility' }
                    ]
                  })
                }
              ]
            }
          }
        ]
      }),
      text: async () => '{}'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_TestKey' });
      const res = await adapter.invoke({ prompt: 'Add logging' });
      assert.strictEqual(Array.isArray(res.operations), true);
      const op = res.operations[0];
      assert.strictEqual(op.type, 'CREATE_FILE');
      assert.strictEqual(typeof op.run, 'undefined', 'Tool operations must not contain executable functions');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
