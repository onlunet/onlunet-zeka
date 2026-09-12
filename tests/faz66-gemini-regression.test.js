import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { ErrorCodes } from '../src/contracts/constants.js';

describe('FAZ 66: Global Regression & Contract Stability', () => {
  it('1. Provider registry includes builtins from FAZ 58-65 without degradation', () => {
    const registry = createProviderRegistry();
    const providers = registry.listProviders();
    assert.ok(providers.length >= 10, 'Must have at least 10 providers');

    assert.ok(registry.hasProvider('local'));
    assert.ok(registry.hasProvider('openai'));
    assert.ok(registry.hasProvider('anthropic'));
    assert.ok(registry.hasProvider('google'));
    assert.ok(registry.hasProvider('gemini'));
  });

  it('2. Core ErrorCodes contract preserved', () => {
    assert.ok(ErrorCodes.INVALID_CONTRACT);
    assert.ok(ErrorCodes.SECURITY_BLOCKED);
    assert.ok(ErrorCodes.VALIDATION_FAILED);
  });
});
