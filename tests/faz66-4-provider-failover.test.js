import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createProviderGateway, GatewayInvocationStatus, ProviderErrorCodes } from '../src/providers/provider-gateway.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createCircuitBreaker, CircuitBreakerState } from '../src/providers/circuit-breaker.js';

describe('FAZ 66.4: Real Provider Failover & Circuit Breaker Architecture', () => {
  it('1. Circuit breaker transitions CLOSED -> OPEN on threshold breach', () => {
    const cb = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.CLOSED);
    assert.strictEqual(cb.canExecute('p1'), true);

    cb.recordFailure('p1', new Error('Err 1'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.CLOSED);
    cb.recordFailure('p1', new Error('Err 2'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.CLOSED);
    cb.recordFailure('p1', new Error('Err 3'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.OPEN);
    assert.strictEqual(cb.canExecute('p1'), false);
  });

  it('2. Circuit breaker transitions OPEN -> HALF_OPEN after cooldown and recovers on success', () => {
    let mockTime = 10000;
    const cb = createCircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 2000,
      now: () => mockTime
    });

    cb.recordFailure('p1', new Error('Err 1'));
    cb.recordFailure('p1', new Error('Err 2'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.OPEN);

    // Advance time beyond cooldown
    mockTime += 2500;
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.HALF_OPEN);
    assert.strictEqual(cb.canExecute('p1'), true);

    // Success in half-open resets to CLOSED
    cb.recordSuccess('p1');
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.CLOSED);
    assert.strictEqual(cb.getStatus('p1').failureCount, 0);
  });

  it('3. Circuit breaker immediately reopens if probe fails in HALF_OPEN', () => {
    let mockTime = 10000;
    const cb = createCircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 2000,
      now: () => mockTime
    });

    cb.recordFailure('p1', new Error('Err 1'));
    cb.recordFailure('p1', new Error('Err 2'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.OPEN);

    mockTime += 2500;
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.HALF_OPEN);

    cb.recordFailure('p1', new Error('Probe failed'));
    assert.strictEqual(cb.getState('p1'), CircuitBreakerState.OPEN);
    assert.strictEqual(cb.canExecute('p1'), false);
  });

  it('4. Gateway executes automatic failover when primary provider fails', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    
    registry.register({
      providerId: 'primary-err',
      name: 'Primary Failing',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        const err = new Error('HTTP 429 Rate Limit Exceeded');
        err.status = 429;
        err.code = 'RATE_LIMITED';
        throw err;
      }
    });

    registry.register({
      providerId: 'fallback-ok',
      name: 'Fallback Healthy',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        return {
          rationale: 'ONLUNET_FAILOVER_OK',
          output: 'ONLUNET_FAILOVER_OK',
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 }
        };
      }
    });

    const gateway = createProviderGateway({ registry, defaultMaxRetries: 1 });
    const res = await gateway.dispatch({
      providerId: 'primary-err',
      fallbackProviderId: 'fallback-ok',
      prompt: 'Return exactly: ONLUNET_FAILOVER_OK',
      retryDelayMs: 10
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'fallback-ok');
    assert.strictEqual(res.primaryProviderId, 'primary-err');
    assert.strictEqual(res.fallbackTriggered, true);
    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.executionAuthorized, false);
    assert.ok(res.output.includes('ONLUNET_FAILOVER_OK'));
  });

  it('5. Gateway skips primary and routes directly to fallback when primary circuit is OPEN', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    let primaryCalled = false;

    registry.register({
      providerId: 'primary-tripped',
      name: 'Primary Tripped',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        primaryCalled = true;
        throw new Error('Should not be called');
      }
    });

    registry.register({
      providerId: 'fallback-active',
      name: 'Fallback Active',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        return {
          rationale: 'CIRCUIT_BYPASS_SUCCESS',
          output: 'CIRCUIT_BYPASS_SUCCESS',
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
        };
      }
    });

    const cb = createCircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure('primary-tripped', new Error('Trip error'));
    assert.strictEqual(cb.getState('primary-tripped'), CircuitBreakerState.OPEN);

    const gateway = createProviderGateway({ registry, circuitBreaker: cb });
    const res = await gateway.dispatch({
      providerId: 'primary-tripped',
      fallbackProviderId: 'fallback-active',
      prompt: 'Execute with tripped primary'
    });

    assert.strictEqual(primaryCalled, false, 'Primary must not be called when circuit is OPEN');
    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'fallback-active');
  });

  it('6. All-providers-failed scenario terminates with classified error and zero authority', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    let p1Count = 0;
    let p2Count = 0;

    registry.register({
      providerId: 'fail-1',
      name: 'Fail 1',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        p1Count++;
        const err = new Error('HTTP 503 Service Unavailable');
        err.status = 503;
        err.code = 'SERVER_ERROR';
        throw err;
      }
    });

    registry.register({
      providerId: 'fail-2',
      name: 'Fail 2',
      isLocal: false,
      hasCredentials: true,
      capabilities: ['TEXT'],
      async invoke() {
        p2Count++;
        const err = new Error('HTTP 401 Unauthorized');
        err.status = 401;
        err.code = 'AUTHENTICATION_FAILED';
        throw err;
      }
    });

    const gateway = createProviderGateway({ registry, defaultMaxRetries: 1 });
    const res = await gateway.dispatch({
      providerId: 'fail-1',
      fallbackProviderId: 'fail-2',
      prompt: 'Both fail',
      retryDelayMs: 10
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
    assert.ok(p1Count <= 2, 'No infinite loop on primary');
    assert.ok(p2Count <= 2, 'No infinite loop on fallback');
    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.executionAuthorized, false);
    assert.ok(res.error.length > 0);
  });
});
