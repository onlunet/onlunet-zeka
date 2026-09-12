/**
 * ONLUNET ZEKA - Provider Health & Availability Monitor
 * FAZ 59 Foundation: Real-time Health, Latency, and State Telemetry
 *
 * Implements fine-grained provider observability:
 * - Status: ONLINE, DEGRADED, OFFLINE, UNCONFIGURED
 * - Latency tracking (exponential moving average)
 * - Circuit state (CLOSED, OPEN, HALF_OPEN)
 * - Credential state (CONFIGURED, UNCONFIGURED)
 * - Capabilities tracking
 * - Last success / failure timestamps & failure classes
 *
 * ZERO SECRETS POLICY: Never outputs keys, headers, or connection strings.
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { sanitizeString } from '../providers/credential-sanitizer.js';

export const ProviderStatus = Object.freeze({
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
  UNCONFIGURED: 'UNCONFIGURED'
});

export const CredentialStatus = Object.freeze({
  CONFIGURED: 'CONFIGURED',
  UNCONFIGURED: 'UNCONFIGURED'
});

export function createProviderHealthMonitor({
  registry = null,
  circuitBreaker = null
} = {}) {
  const metrics = new Map();

  function getOrInit(providerId) {
    const id = String(providerId).trim().toLowerCase();
    if (!metrics.has(id)) {
      metrics.set(id, {
        providerId: id,
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        lastLatencyMs: 0,
        avgLatencyMs: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureClass: null,
        lastErrorReason: null
      });
    }
    return metrics.get(id);
  }

  return Object.freeze({
    recordSuccess(providerId, latencyMs = 0) {
      const entry = getOrInit(providerId);
      entry.totalCalls += 1;
      entry.successCount += 1;
      entry.lastLatencyMs = latencyMs;
      entry.avgLatencyMs = entry.avgLatencyMs === 0 ? latencyMs : Math.round((entry.avgLatencyMs * 0.8) + (latencyMs * 0.2));
      entry.lastSuccessAt = new Date().toISOString();
    },

    recordFailure(providerId, error, latencyMs = 0) {
      const entry = getOrInit(providerId);
      entry.totalCalls += 1;
      entry.failureCount += 1;
      entry.lastLatencyMs = latencyMs;
      entry.lastFailureAt = new Date().toISOString();

      const errMsg = error ? (typeof error.message === 'string' ? error.message : String(error)) : 'Unknown error';
      entry.lastErrorReason = sanitizeString(errMsg);

      if (error && (error.code === 'TIMEOUT' || (error.name === 'AbortError'))) {
        entry.timeoutCount += 1;
        entry.lastFailureClass = 'TIMEOUT';
      } else if (error && (error.code === 'CREDENTIALS_UNCONFIGURED' || errMsg.includes('CREDENTIALS_UNCONFIGURED'))) {
        entry.lastFailureClass = 'CREDENTIALS_UNCONFIGURED';
      } else {
        entry.lastFailureClass = (error && error.code) || 'PROVIDER_ERROR';
      }
    },

    getHealth(providerId) {
      const id = String(providerId).trim().toLowerCase();
      const entry = getOrInit(id);

      let circuitState = 'CLOSED';
      if (circuitBreaker && typeof circuitBreaker.getStatus === 'function') {
        const cbStatus = circuitBreaker.getStatus(id);
        if (cbStatus) {
          circuitState = cbStatus.state;
        }
      }

      let credentialState = CredentialStatus.CONFIGURED;
      let capabilities = [];

      if (registry && typeof registry.getProvider === 'function') {
        try {
          const adapter = registry.getProvider(id);
          if (adapter) {
            credentialState = adapter.hasCredentials || adapter.isLocal ? CredentialStatus.CONFIGURED : CredentialStatus.UNCONFIGURED;
            if (Array.isArray(adapter.capabilities)) {
              capabilities = [...adapter.capabilities];
            }
          }
        } catch {
          // If registry throws, check standard local provider
          if (id === 'local' || id === 'local-provider') {
            credentialState = CredentialStatus.CONFIGURED;
          }
        }
      }

      // Compute overall status
      let status = ProviderStatus.ONLINE;
      if (credentialState === CredentialStatus.UNCONFIGURED) {
        status = ProviderStatus.UNCONFIGURED;
      } else if (circuitState === 'OPEN') {
        status = ProviderStatus.OFFLINE;
      } else if (circuitState === 'HALF_OPEN' || (entry.totalCalls > 5 && (entry.failureCount / entry.totalCalls) > 0.2)) {
        status = ProviderStatus.DEGRADED;
      }

      return Object.freeze({
        providerId: id,
        status,
        latencyMs: entry.avgLatencyMs,
        circuitState,
        credentialState,
        capabilities: Object.freeze(capabilities),
        lastSuccessAt: entry.lastSuccessAt,
        lastFailureAt: entry.lastFailureAt,
        failureClass: entry.lastFailureClass
      });
    },

    getAllHealth() {
      const result = {};
      const knownProviders = ['openai', 'anthropic', 'google', 'custom', 'local'];
      for (const p of knownProviders) {
        result[p] = this.getHealth(p);
      }
      return result;
    }
  });
}
