/**
 * ONLUNET ZEKA - FAZ 63 Live Provider Verification Suite
 * Validates minimal inference for local provider and NOT_CONFIGURED for uncredentialed cloud
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createProviderGateway } from '../src/providers/provider-gateway.js';

describe('FAZ 63.3 & 63.4: Real Provider Connectivity & Live Certification Loop', () => {
  it('executes minimal live test on local deterministic provider', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Return JSON only: {"status":"ok"}'
    });

    assert.equal(res.status, 'SUCCESS');
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.proposalOnly, true);
    assert.ok(res.latencyMs >= 0);
  });

  it('enforces Zero Fake Pass: unconfigured cloud providers fail closed without simulation', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const cloudProviders = ['openai', 'anthropic', 'gemini', 'xai', 'mistral', 'deepseek', 'groq', 'openrouter'];

    for (const pid of cloudProviders) {
      const adapter = registry.getProvider(pid);
      if (!adapter.hasCredentials) {
        const health = await adapter.checkHealth();
        assert.ok(
          health.status === 'CREDENTIALS_UNCONFIGURED' || health.status === 'NOT_CONFIGURED',
          `Expected unconfigured status, got: ${health.status}`
        );
        assert.equal(health.ready, false);
      }
    }
  });
});
