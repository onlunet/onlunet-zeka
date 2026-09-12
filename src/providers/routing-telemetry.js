/**
 * ONLUNET ZEKA - Routing Telemetry & Observability
 * FAZ 63 Foundation: Audit Trail, Metrics & Decision Telemetry
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 * STRICT PRIVACY: Zero secret or prompt credential leakage.
 */
import { sanitizeString } from './credential-sanitizer.js';

export function createRoutingTelemetry({ maxEntries = 500 } = {}) {
  const entries = [];

  return Object.freeze({
    record({
      requestId = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskType = 'GENERAL_QA',
      selectedProvider,
      selectedModel,
      routingScore = null,
      selectionReason = '',
      rejectedProviders = [],
      latencyMs = null,
      tokens = null,
      cost = null,
      failure = null,
      fallback = null,
      tenantId = null,
      workspaceId = null
    } = {}) {
      const entry = Object.freeze({
        id: requestId,
        taskType,
        selectedProvider,
        selectedModel,
        routingScore,
        selectionReason: sanitizeString(selectionReason),
        rejectedProviders: Object.freeze([...(rejectedProviders || [])]),
        latencyMs,
        tokens,
        cost,
        failure: failure ? sanitizeString(failure) : null,
        fallback,
        tenantId,
        workspaceId,
        timestamp: new Date().toISOString()
      });

      entries.push(entry);
      if (entries.length > maxEntries) {
        entries.shift();
      }
      return entry;
    },

    getEvents({ tenantId = null, limit = 100 } = {}) {
      let filtered = entries;
      if (tenantId) {
        filtered = filtered.filter(e => e.tenantId === tenantId);
      }
      return Object.freeze(filtered.slice(-limit));
    },

    getMetrics() {
      const providerCounts = {};
      const modelCounts = {};
      let totalEvents = entries.length;
      let failureCount = 0;
      let fallbackCount = 0;

      for (const e of entries) {
        providerCounts[e.selectedProvider] = (providerCounts[e.selectedProvider] || 0) + 1;
        if (e.selectedModel) {
          modelCounts[e.selectedModel] = (modelCounts[e.selectedModel] || 0) + 1;
        }
        if (e.failure) failureCount++;
        if (e.fallback) fallbackCount++;
      }

      return Object.freeze({
        totalEvents,
        failureCount,
        fallbackCount,
        providerCounts: Object.freeze(providerCounts),
        modelCounts: Object.freeze(modelCounts)
      });
    },

    clear() {
      entries.length = 0;
    },

    count() {
      return entries.length;
    }
  });
}
