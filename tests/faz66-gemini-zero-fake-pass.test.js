import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Zero Fake Pass Absolute Enforcement', () => {
  it('1. In absence of credentials, live status is NEVER reported as ready', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origGKey = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: null });
      const health = await adapter.checkHealth();
      assert.strictEqual(health.ready, false);
      assert.notStrictEqual(health.status, 'HEALTHY');
      assert.strictEqual(health.status, 'CREDENTIALS_UNCONFIGURED');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      if (origGKey) process.env.GOOGLE_API_KEY = origGKey;
    }
  });

  it('2. No mock/stub bypasses zero-fake-pass gate', () => {
    const adapter = createGeminiProviderAdapter({ apiKey: null });
    assert.strictEqual(adapter.hasCredentials, false);
  });
});
