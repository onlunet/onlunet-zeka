/**
 * ONLUNET ZEKA - FAZ 62 Secret Management & Configuration Schema Suite
 * Validates credentialRef usage and rejection of raw secrets in config
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { validateProviderConfig } from '../src/providers/provider-config.js';

describe('FAZ 62.20 & 62.23: Secret Management & Config Schema', () => {
  it('validates provider configuration using credentialRef without raw secrets', () => {
    const validConfig = {
      providerId: 'mistral-eu-1',
      credentialRef: 'MISTRAL_PROD_API_KEY',
      endpoint: 'https://api.mistral.ai/v1',
      defaultModel: 'mistral-large-latest',
      priority: 'PRIMARY'
    };

    const validated = validateProviderConfig(validConfig);
    assert.equal(validated.providerId, 'mistral-eu-1');
    assert.equal(validated.credentialRef, 'MISTRAL_PROD_API_KEY');
  });

  it('rejects raw API key in configuration payload fail-closed', () => {
    const badConfig = {
      providerId: 'leaky-provider',
      apiKey: 'sk-proj-1234567890abcdefghijklmnop'
    };

    assert.throws(
      () => validateProviderConfig(badConfig),
      /Raw secret detected/
    );
  });
});
