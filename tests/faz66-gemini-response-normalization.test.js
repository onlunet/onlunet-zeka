import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Response Canonical Normalization', () => {
  it('1. Normalized payload includes proposalOnly: true & executionAuthorized: false', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  rationale: 'Refactor database connection pool',
                  operations: [{ type: 'REFACTOR', target: 'db.js', description: 'increase pool' }],
                  proposedFiles: ['db.js'],
                  proposedTests: ['db.test.js'],
                  risks: ['memory usage'],
                  assumptions: ['pg driver installed']
                })
              }
            ]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 120,
        totalTokenCount: 170
      }
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockGeminiResponse,
      text: async () => JSON.stringify(mockGeminiResponse)
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_Test1234567890' });
      const res = await adapter.invoke({ prompt: 'Optimize db pool' });

      assert.strictEqual(res.providerId, 'gemini');
      assert.strictEqual(res.proposalOnly, true);
      assert.strictEqual(res.executionAuthorized, false);
      assert.strictEqual(res.isProposal, true);
      assert.strictEqual(res.rationale, 'Refactor database connection pool');
      assert.strictEqual(res.operations.length, 1);
      assert.strictEqual(res.usage.inputTokens, 50);
      assert.strictEqual(res.usage.outputTokens, 120);
      assert.strictEqual(res.usage.totalTokens, 170);
      assert.ok(res.cost !== undefined);
      assert.strictEqual(res.finishReason, 'STOP');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('2. Robust markdown JSON code block extraction', async () => {
    const markdownContent = "\x60\x60\x60json\n{\"rationale\": \"Embedded json test\", \"operations\": []}\n\x60\x60\x60";
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: markdownContent }]
          }
        }
      ]
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockGeminiResponse,
      text: async () => JSON.stringify(mockGeminiResponse)
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_Test1234567890' });
      const res = await adapter.invoke({ prompt: 'Run block test' });
      assert.strictEqual(res.rationale, 'Embedded json test');
      assert.deepStrictEqual(res.operations, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
