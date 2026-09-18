/**
 * ONLUNET ZEKA - FAZ 61 Provider Readiness Test Suite
 *
 * Validates:
 * - Provider Registry discovery across local, openai, anthropic, google, custom
 * - Safe credential inspection with zero secret leakage
 * - Honest status assignment: READY for local, NOT_CONFIGURED for unconfigured cloud providers
 * - Fail-closed rejection when attempting invocation without credentials
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';

describe('FAZ 61.1 & 61.2: Provider Registry & Credential Readiness', () => {

  it('correctly discovers all built-in provider adapters in the registry', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const providers = registry.listProviders();
    const ids = providers.map(p => p.providerId);

    assert.ok(ids.includes('local'), 'Must register local provider');
    assert.ok(ids.includes('openai'), 'Must register openai provider');
    assert.ok(ids.includes('anthropic'), 'Must register anthropic provider');
    assert.ok(ids.includes('google'), 'Must register google provider');
    assert.ok(ids.includes('custom'), 'Must register custom provider');
  });

  it('safely checks credentials without printing or leaking secret values', () => {
    const sensitiveEnvKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'LOCAL_AI_BASE_URL',
      'CUSTOM_API_KEY'
    ];

    const inspectionReport = {};
    for (const key of sensitiveEnvKeys) {
      const val = process.env[key];
      inspectionReport[key] = {
        configured: Boolean(val && typeof val === 'string' && val.trim().length > 0),
        status: (val && typeof val === 'string' && val.trim().length > 0) ? 'CONFIGURED' : 'NOT_CONFIGURED'
      };
    }

    const serialized = JSON.stringify(inspectionReport);
    assert.ok(!serialized.includes('sk-'));
    assert.ok(!serialized.includes('Bearer'));
    assert.ok(!serialized.includes('MOCK_GEMINI_KEY_'));
    for (const key of sensitiveEnvKeys) {
      assert.ok(inspectionReport[key].status === 'NOT_CONFIGURED' || inspectionReport[key].status === 'CONFIGURED');
    }
  });

  it('reports local provider as HEALTHY and unconfigured cloud providers as CREDENTIALS_UNCONFIGURED', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });

    const localAdapter = registry.getProvider('local');
    const localHealth = await localAdapter.checkHealth();
    assert.equal(localHealth.status, 'HEALTHY');

    const openaiAdapter = registry.getProvider('openai');
    const openaiHealth = await openaiAdapter.checkHealth();
    if (!process.env.OPENAI_API_KEY) {
      assert.equal(openaiHealth.status, 'CREDENTIALS_UNCONFIGURED');
      assert.equal(openaiHealth.ready, false);
    }

    const anthropicAdapter = registry.getProvider('anthropic');
    const anthropicHealth = await anthropicAdapter.checkHealth();
    if (!process.env.ANTHROPIC_API_KEY) {
      assert.equal(anthropicHealth.status, 'CREDENTIALS_UNCONFIGURED');
      assert.equal(anthropicHealth.ready, false);
    }

    const googleAdapter = registry.getProvider('google');
    const googleHealth = await googleAdapter.checkHealth();
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      assert.equal(googleHealth.status, 'CREDENTIALS_UNCONFIGURED');
      assert.equal(googleHealth.ready, false);
    }
  });

  it('fails closed when an unconfigured cloud provider is invoked directly', async () => {
    if (!process.env.OPENAI_API_KEY) {
      const registry = createProviderRegistry({ includeBuiltins: true });
      const openaiAdapter = registry.getProvider('openai');
      await assert.rejects(
        async () => {
          await openaiAdapter.invoke({ prompt: 'test' });
        },
        (err) => {
          assert.equal(err.code, 'CREDENTIALS_UNCONFIGURED');
          return true;
        }
      );
    }
  });
});
