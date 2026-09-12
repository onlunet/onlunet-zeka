/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Circuit Breaker Lifecycle Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createCircuitBreaker } from '../src/providers/circuit-breaker.js';

describe('FAZ 64.10: OpenAI Circuit Breaker Lifecycle', () => {
  it('transitions CLOSED -> OPEN on failure threshold and fast-fails closed', () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    assert.strictEqual(cb.canExecute('openai'), true);

    cb.recordFailure('openai', new Error('Fail 1'));
    assert.strictEqual(cb.canExecute('openai'), true);

    cb.recordFailure('openai', new Error('Fail 2'));
    assert.strictEqual(cb.canExecute('openai'), false); // Tripped OPEN
  });
});
