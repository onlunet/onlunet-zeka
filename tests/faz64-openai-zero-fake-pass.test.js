/**
 * ONLUNET ZEKA - FAZ 64 Zero Fake Pass Certification Guard
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createOpenAIProviderAdapter } from '../src/providers/openai-adapter.js';

describe('FAZ 64.20: Zero Fake Pass Certification Enforcement', () => {
  it('proves that in the absence of real credentials, OpenAI cannot be certified as LIVE_CERTIFIED', async () => {
    if (!process.env.OPENAI_API_KEY) {
      const adapter = createOpenAIProviderAdapter();
      const health = await adapter.checkHealth();

      assert.notEqual(health.status, 'HEALTHY');
      assert.ok(['CREDENTIALS_UNCONFIGURED', 'NOT_CONFIGURED'].includes(health.status));
      assert.strictEqual(health.ready, false);
    }
  });
});
