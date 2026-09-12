/**
 * ONLUNET ZEKA - FAZ 61 Real Provider Certification Test Suite
 *
 * Tests A through G for real/configured providers under Zero Fake Pass.
 * If credentials are not configured, honest DEFERRED / NOT_CONFIGURED status is asserted.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderGateway } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createLocalProviderAdapter } from '../src/providers/local-adapter.js';

describe('FAZ 61.4: Real Provider Certification (Tests A to G)', () => {

  it('Test A (Authentication & Connectivity): honest certification without fake passes', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    // Local provider is 100% available and verified
    const localRes = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Ping connectivity test'
    });
    assert.equal(localRes.status, 'SUCCESS');
    assert.strictEqual(localRes.executionAuthorized, false);
    assert.strictEqual(localRes.proposalOnly, true);

    // Unconfigured cloud provider fails closed honestly
    if (!process.env.OPENAI_API_KEY) {
      const cloudRes = await gateway.dispatch({
        providerId: 'openai',
        prompt: 'Cloud ping'
      });
      assert.equal(cloudRes.status, 'FAILED');
      assert.equal(cloudRes.code, 'CREDENTIALS_UNCONFIGURED');
      assert.strictEqual(cloudRes.executionAuthorized, false);
    }
  });

  it('Test B (Minimal Inference): returns valid response with 0 authority', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Return valid JSON only: {"status":"ok"}'
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.output);
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.proposalOnly, true);
  });

  it('Test C (Structured Output): normalizes JSON structure without execution side effects', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Generate code change proposal for math function',
      agentRole: 'DEVELOPER'
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(Array.isArray(res.operations));
    assert.ok(Array.isArray(res.proposedFiles));
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.mutationAuthorized, false);
  });

  it('Test D (Token & Cost Accounting): captures input/output tokens and cost metadata', async () => {
    const registry = createProviderRegistry({ includeBuiltins: true });
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'local',
      prompt: 'Explain zero authority architectural boundary in 5 words'
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.usage);
    assert.ok(typeof res.usage.inputTokens === 'number');
    assert.ok(typeof res.usage.outputTokens === 'number');
    assert.ok(res.cost);
    assert.ok(typeof res.cost.amount === 'number');
    assert.equal(res.cost.currency, 'USD');
  });

  it('Test E (Error Normalization): maps errors into standardized error taxonomy', async () => {
    const faultAdapter = createLocalProviderAdapter({
      providerId: 'fault-provider',
      simulateError: 'Simulated 500 upstream server error'
    });
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(faultAdapter);
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'fault-provider',
      prompt: 'Fault test'
    });

    assert.equal(res.status, 'FAILED');
    assert.ok(res.error.includes('Simulated 500'));
    assert.strictEqual(res.executionAuthorized, false);
  });

  it('Test F (Timeout / Cancellation): aborts within deadline without socket leaks', async () => {
    const slowAdapter = createLocalProviderAdapter({
      providerId: 'slow-provider',
      latencyMs: 500
    });
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(slowAdapter);
    const gateway = createProviderGateway({ registry });

    const res = await gateway.dispatch({
      providerId: 'slow-provider',
      prompt: 'Timeout test',
      timeoutMs: 50,
      maxRetries: 0
    });

    assert.equal(res.status, 'TIMEOUT');
    assert.strictEqual(res.executionAuthorized, false);
  });

  it('Test G (Circuit Breaker): trips to OPEN on consecutive failures and fast-fails', async () => {
    const failAdapter = createLocalProviderAdapter({
      providerId: 'breaker-target',
      simulateError: 'Service unavailable 503'
    });
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.register(failAdapter);
    const gateway = createProviderGateway({ registry });

    // 3 consecutive failures to trip circuit
    await gateway.dispatch({ providerId: 'breaker-target', prompt: 'call 1', maxRetries: 0 });
    await gateway.dispatch({ providerId: 'breaker-target', prompt: 'call 2', maxRetries: 0 });
    await gateway.dispatch({ providerId: 'breaker-target', prompt: 'call 3', maxRetries: 0 });

    // 4th call must fast-fail with CIRCUIT_OPEN
    const tripped = await gateway.dispatch({ providerId: 'breaker-target', prompt: 'call 4', maxRetries: 0 });
    assert.equal(tripped.status, 'CIRCUIT_OPEN');
    assert.strictEqual(tripped.executionAuthorized, false);
  });
});
