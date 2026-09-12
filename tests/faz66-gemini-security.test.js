import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Security & Confinement Gating', () => {
  it('1. Adapter object is frozen against parameter tampering', () => {
    const adapter = createGeminiProviderAdapter();
    assert.ok(Object.isFrozen(adapter));
    assert.throws(() => {
      adapter.name = 'Hacked';
    });
  });

  it('2. Capabilities array is immutable', () => {
    const adapter = createGeminiProviderAdapter();
    assert.ok(Object.isFrozen(adapter.capabilities));
    assert.throws(() => {
      adapter.capabilities.push('MALICIOUS_CAP');
    });
  });

  it('3. Rejects prototype pollution attack vectors', () => {
    assert.doesNotThrow(() => {
      createGeminiProviderAdapter({
        __proto__: { injected: true },
        constructor: { prototype: { poll: true } }
      });
    });
    assert.strictEqual(Object.prototype.injected, undefined);
  });
});
