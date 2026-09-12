/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Real HTTP Transport & Zero Fake Pass Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createOpenAIProviderAdapter } from '../src/providers/openai-adapter.js';

describe('FAZ 64.2: OpenAI Live HTTP Transport & Zero Fake Pass Verification', () => {
  it('executes real HTTPS request if credential present, or fails closed with CREDENTIALS_UNCONFIGURED', async () => {
    const adapter = createOpenAIProviderAdapter();

    if (!process.env.OPENAI_API_KEY) {
      assert.strictEqual(adapter.hasCredentials, false);
      const health = await adapter.checkHealth();
      assert.ok(['CREDENTIALS_UNCONFIGURED', 'NOT_CONFIGURED'].includes(health.status));
      assert.strictEqual(health.ready, false);

      await assert.rejects(
        () => adapter.invoke({ prompt: 'Reply with exactly: LIVE_OK' }),
        (err) => err.code === 'CREDENTIALS_UNCONFIGURED'
      );
    } else {
      // Live execution only when key is provided
      const res = await adapter.invoke({ prompt: 'Reply with exactly: LIVE_OK' });
      assert.ok(res.latencyMs >= 0);
      assert.ok(res.usage);
      assert.equal(res.providerId, 'openai');
    }
  });
});
