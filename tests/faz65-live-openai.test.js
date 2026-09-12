/**
 * ONLUNET ZEKA - FAZ 65 OpenAI Live Certification & Zero Fake Pass Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createOpenAIProviderAdapter } from '../src/providers/openai-adapter.js';

describe('FAZ 65.20: OpenAI Live Provider Verification & Zero Fake Pass', () => {
  it('strictly enforces fail-closed or live execution without synthetic mock certification', async () => {
    const adapter = createOpenAIProviderAdapter();
    const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

    if (!hasKey) {
      // CASE B: Key absent -> assert unconfigured status, never fake LIVE_CERTIFIED
      const health = await adapter.checkHealth();
      assert.strictEqual(health.status, 'CREDENTIALS_UNCONFIGURED');
      assert.strictEqual(adapter.hasCredentials, false);
    } else {
      // CASE A: Key present -> perform real minimal ping
      const health = await adapter.checkHealth();
      assert.ok(['HEALTHY', 'AUTHENTICATION_FAILED', 'RATE_LIMITED'].includes(health.status));
    }
  });
});
