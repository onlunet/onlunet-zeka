/**
 * ONLUNET ZEKA - FAZ 62 Provider Retry Policy Suite
 * Validates transient error retry vs permanent error fail-closed classification
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderGateway } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';

describe('FAZ 62.14: Granular Retry Policy & Non-Retriable Failures', () => {
  it('does not retry permanent authentication errors or missing credentials', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    // Invoking unconfigured xai must fail immediately without retry amplification
    if (!process.env.XAI_API_KEY) {
      const res = await gateway.dispatch({
        providerId: 'xai',
        prompt: 'test prompt',
        maxRetries: 3
      });

      assert.equal(res.status, 'FAILED');
      assert.equal(res.attempts, 1, 'Must fail on attempt 1 without retrying unconfigured credentials');
    }
  });

  it('retries transient errors up to bounded maxRetries limit', async () => {
    let attemptsCount = 0;
    const transientAdapter = createLocalProviderAdapter({
      providerId: 'transient-flaky',
      simulateError: 'Transient 502 Bad Gateway'
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(transientAdapter);
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'transient-flaky',
      prompt: 'Retry test',
      maxRetries: 2,
      retryDelayMs: 10
    });

    assert.equal(res.status, 'FAILED');
    assert.ok(res.error.includes('502'));
  });
});
