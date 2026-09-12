import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createCircuitBreaker, CircuitBreakerState } from '../src/providers/circuit-breaker.js';

describe('FAZ 66: Gemini Retry Policy & Circuit Breaker', () => {
  it('1. Circuit breaker trips after consecutive failures', () => {
    const cb = createCircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 5000
    });

    assert.strictEqual(cb.getState('gemini'), CircuitBreakerState.CLOSED);
    assert.strictEqual(cb.canExecute('gemini'), true);

    cb.recordFailure('gemini', new Error('503 Service Unavailable'));
    cb.recordFailure('gemini', new Error('503 Service Unavailable'));
    assert.strictEqual(cb.getState('gemini'), CircuitBreakerState.CLOSED);

    cb.recordFailure('gemini', new Error('503 Service Unavailable'));
    assert.strictEqual(cb.getState('gemini'), CircuitBreakerState.OPEN);
    assert.strictEqual(cb.canExecute('gemini'), false);
  });
});
