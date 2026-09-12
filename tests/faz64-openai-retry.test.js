/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Retry Policy Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderGateway } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 64.7: OpenAI Non-Retriable Failures & Bounded Retry', () => {
  it('does not retry unconfigured credentials and halts after 1 attempt', async () => {
    if (!process.env.OPENAI_API_KEY) {
      const registry = createProviderRegistry({ includeBuiltins: true });
      const gateway = createProviderGateway({ registry });

      const res = await gateway.dispatch({
        providerId: 'openai',
        prompt: 'test prompt',
        maxRetries: 3
      });

      assert.equal(res.status, 'FAILED');
      assert.equal(res.attempts, 1);
    }
  });
});
