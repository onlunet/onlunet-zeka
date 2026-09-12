/**
 * ONLUNET ZEKA - FAZ 62 Provider Health & Availability Suite
 * Validates health check lifecycle states without secret leakage
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { LifecycleState } from '../src/providers/provider-categories.js';

describe('FAZ 62.9: Provider Health & Lifecycle State', () => {
  it('checks all provider health statuses safely and accurately', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const allHealth = await registry.checkAllHealth();

    assert.ok(allHealth['local']);
    assert.equal(allHealth['local'].status, 'HEALTHY');

    // Unconfigured cloud providers must report NOT_CONFIGURED or CREDENTIALS_UNCONFIGURED
    if (!process.env.OPENAI_API_KEY) {
      assert.ok(allHealth['openai'].status === 'CREDENTIALS_UNCONFIGURED' || allHealth['openai'].status === LifecycleState.NOT_CONFIGURED);
    }
    if (!process.env.XAI_API_KEY) {
      assert.ok(allHealth['xai'].status === LifecycleState.NOT_CONFIGURED || allHealth['xai'].status === 'CREDENTIALS_UNCONFIGURED');
    }
    if (!process.env.GROQ_API_KEY) {
      assert.ok(allHealth['groq'].status === LifecycleState.NOT_CONFIGURED || allHealth['groq'].status === 'CREDENTIALS_UNCONFIGURED');
    }
  });

  it('proves zero secret or authorization header leakage in health check diagnostics', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const allHealth = await registry.checkAllHealth();
    const serialized = JSON.stringify(allHealth);

    assert.ok(!serialized.includes('Bearer'));
    assert.ok(!serialized.includes('sk-'));
    assert.ok(!serialized.includes('Authorization'));
  });
});
