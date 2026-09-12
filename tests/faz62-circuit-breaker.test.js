/**
 * ONLUNET ZEKA - FAZ 62 Independent Circuit Breaker Suite
 * Validates independent per-provider circuit breaker states
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createCircuitBreaker } from '../src/providers/circuit-breaker.js';

describe('FAZ 62.13: Independent Per-Provider Circuit Breakers', () => {
  it('trips circuit breaker for Provider A without affecting Provider B', () => {
    const cb = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000 });

    // Provider A fails 3 times
    cb.recordFailure('openai', new Error('503 Service Unavailable'));
    cb.recordFailure('openai', new Error('503 Service Unavailable'));
    cb.recordFailure('openai', new Error('503 Service Unavailable'));

    // Provider A must be OPEN
    assert.strictEqual(cb.canExecute('openai'), false);

    // Provider B (anthropic) and Provider C (groq) must remain CLOSED & executable
    assert.strictEqual(cb.canExecute('anthropic'), true);
    assert.strictEqual(cb.canExecute('groq'), true);
    assert.strictEqual(cb.canExecute('local'), true);
  });
});
