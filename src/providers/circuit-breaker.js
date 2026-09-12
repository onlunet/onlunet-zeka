/**
 * ONLUNET ZEKA - Provider Circuit Breaker
 * FAZ 58 Foundation: Resilient Failure Isolation for AI Providers
 *
 * Implements:
 * - CLOSED, OPEN, HALF_OPEN states
 * - Automatic transition to HALF_OPEN after cooldownMs
 * - Immediate fail-closed rejection when OPEN
 * - Zero external dependencies
 */

import { sanitizeString } from './credential-sanitizer.js';

export const CircuitBreakerState = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
});

export function createCircuitBreaker({
  failureThreshold = 3,
  cooldownMs = 5000,
  now = () => Date.now(),
  onStateChange = null
} = {}) {
  // Map of providerId -> { state, failureCount, consecutiveSuccesses, openedAt, lastError }
  const providers = new Map();

  function getEntry(providerId) {
    const key = String(providerId || 'default').trim();
    if (!providers.has(key)) {
      providers.set(key, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        consecutiveSuccesses: 0,
        openedAt: null,
        lastError: null
      });
    }
    return providers.get(key);
  }

  function transition(key, entry, newState, reason = '') {
    const oldState = entry.state;
    if (oldState !== newState) {
      entry.state = newState;
      if (typeof onStateChange === 'function') {
        try {
          onStateChange({
            providerId: key,
            fromState: oldState,
            toState: newState,
            reason,
            timestamp: now()
          });
        } catch {
          // Non-blocking callback
        }
      }
    }
  }

  return Object.freeze({
    failureThreshold,
    cooldownMs,

    getState(providerId) {
      const key = String(providerId || 'default').trim();
      const entry = getEntry(key);

      // If OPEN, check if cooldown has elapsed to allow HALF_OPEN probe
      if (entry.state === CircuitBreakerState.OPEN) {
        const elapsed = now() - (entry.openedAt || 0);
        if (elapsed >= cooldownMs) {
          transition(key, entry, CircuitBreakerState.HALF_OPEN, 'Cooldown elapsed; probing provider');
        }
      }

      return entry.state;
    },

    canExecute(providerId) {
      const state = this.getState(providerId);
      return state === CircuitBreakerState.CLOSED || state === CircuitBreakerState.HALF_OPEN;
    },

    recordSuccess(providerId) {
      const key = String(providerId || 'default').trim();
      const entry = getEntry(key);

      if (entry.state === CircuitBreakerState.HALF_OPEN) {
        entry.failureCount = 0;
        entry.openedAt = null;
        entry.lastError = null;
        transition(key, entry, CircuitBreakerState.CLOSED, 'Probe succeeded; closing circuit');
      } else if (entry.state === CircuitBreakerState.CLOSED) {
        entry.failureCount = 0;
        entry.lastError = null;
      }
    },

    recordFailure(providerId, error = null) {
      const key = String(providerId || 'default').trim();
      const entry = getEntry(key);
      entry.failureCount += 1;
      entry.lastError = error ? sanitizeString(String(error.message || error)) : 'Provider invocation failed';

      if (entry.state === CircuitBreakerState.HALF_OPEN) {
        // Probe failed -> Re-open immediately
        entry.openedAt = now();
        transition(key, entry, CircuitBreakerState.OPEN, 'Half-open probe failed; reopening circuit');
      } else if (entry.state === CircuitBreakerState.CLOSED) {
        if (entry.failureCount >= failureThreshold) {
          entry.openedAt = now();
          transition(key, entry, CircuitBreakerState.OPEN, `Failure threshold (${failureThreshold}) exceeded`);
        }
      }
    },

    reset(providerId) {
      const key = String(providerId || 'default').trim();
      const entry = getEntry(key);
      entry.state = CircuitBreakerState.CLOSED;
      entry.failureCount = 0;
      entry.openedAt = null;
      entry.lastError = null;
    },

    getStatus(providerId) {
      const key = String(providerId || 'default').trim();
      const entry = getEntry(key);
      const state = this.getState(key);
      return Object.freeze({
        providerId: key,
        state,
        failureCount: entry.failureCount,
        lastError: entry.lastError,
        openedAt: entry.openedAt
      });
    },

    getAllStates() {
      const result = {};
      for (const [key] of providers.entries()) {
        result[key] = this.getState(key);
      }
      return Object.freeze(result);
    }
  });
}
