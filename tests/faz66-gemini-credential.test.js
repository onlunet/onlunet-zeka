import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGoogleProviderAdapter, createGeminiProviderAdapter } from '../src/providers/google-adapter.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 66: Gemini Credential & Health Discovery', () => {
  it('1. Detects missing GEMINI_API_KEY and marks adapter unconfigured', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origGKey = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: null });
      assert.strictEqual(adapter.hasCredentials, false);
      const health = await adapter.checkHealth();
      assert.strictEqual(health.status, 'CREDENTIALS_UNCONFIGURED');
      assert.strictEqual(health.ready, false);
      assert.strictEqual(health.providerId, 'gemini');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      if (origGKey) process.env.GOOGLE_API_KEY = origGKey;
    }
  });

  it('2. Throws CREDENTIALS_UNCONFIGURED when invoking without credentials', async () => {
    const adapter = createGeminiProviderAdapter({ apiKey: null });
    await assert.rejects(
      async () => {
        await adapter.invoke({ prompt: 'test prompt' });
      },
      (err) => {
        assert.strictEqual(err.code, 'CREDENTIALS_UNCONFIGURED');
        return true;
      }
    );
  });

  it('3. Recognizes explicit apiKey in constructor', async () => {
    const adapter = createGeminiProviderAdapter({ apiKey: 'MOCK_GEMINI_KEY_FakeKeyForTestOnly1234567890' });
    assert.strictEqual(adapter.hasCredentials, true);
    const health = await adapter.checkHealth();
    assert.strictEqual(health.status, 'HEALTHY');
    assert.strictEqual(health.ready, true);
  });

  it('4. Never leaks raw secret in stringified adapter or health output', async () => {
    const secret = 'MOCK_GEMINI_KEY_SecretTestKeyThatMustNotLeak12345';
    const adapter = createGeminiProviderAdapter({ apiKey: secret });
    const str = JSON.stringify(adapter);
    assert.ok(!str.includes(secret), 'Raw API key must not be present in serialized adapter');
    const health = await adapter.checkHealth();
    assert.ok(!JSON.stringify(health).includes(secret), 'Raw key must not be in health response');
  });

  it('5. Provider registry lists both google and gemini entries safely', () => {
    const registry = createProviderRegistry();
    assert.ok(registry.hasProvider('google'));
    assert.ok(registry.hasProvider('gemini'));
    const entryG = registry.getEntry('google');
    const entryGem = registry.getEntry('gemini');
    assert.strictEqual(entryG.providerId, 'google');
    assert.strictEqual(entryGem.providerId, 'gemini');
  });
});
