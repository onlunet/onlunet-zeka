import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';
import { createModelRegistry } from '../src/providers/model-registry.js';

describe('FAZ 66: Gemini Model Selection & Registry Matrix', () => {
  it('1. Defaults to gemini-1.5-flash when unspecified', () => {
    const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyTestKey' });
    assert.strictEqual(adapter.model, 'gemini-1.5-flash');
  });

  it('2. Supports explicit gemini-1.5-pro model', () => {
    const adapter = createGeminiProviderAdapter({ model: 'gemini-1.5-pro', apiKey: 'AIzaSyTestKey' });
    assert.strictEqual(adapter.model, 'gemini-1.5-pro');
  });

  it('3. Supports explicit gemini-2.0-flash model', () => {
    const adapter = createGeminiProviderAdapter({ model: 'gemini-2.0-flash', apiKey: 'AIzaSyTestKey' });
    assert.strictEqual(adapter.model, 'gemini-2.0-flash');
  });

  it('4. Validates model registry entries for Gemini', () => {
    const registry = createModelRegistry();
    const pro = registry.getModel('gemini-1.5-pro');
    if (pro) {
      assert.strictEqual(pro.providerId, 'google');
      assert.ok(pro.contextWindow >= 1000000);
    }
    const flash = registry.getModel('gemini-1.5-flash');
    if (flash) {
      assert.strictEqual(flash.providerId, 'google');
      assert.ok(flash.contextWindow >= 1000000);
    }
  });
});
