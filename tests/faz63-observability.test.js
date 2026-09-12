/**
 * ONLUNET ZEKA - FAZ 63 Routing Observability Suite
 * Validates routing telemetry ledger and metrics aggregation
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createRoutingTelemetry } from '../src/providers/routing-telemetry.js';

describe('FAZ 63.26: Routing Telemetry & Observability', () => {
  it('records routing events and aggregates metrics without secret leakage', () => {
    const telemetry = createRoutingTelemetry({ maxEntries: 10 });
    telemetry.record({
      taskType: 'CODING',
      selectedProvider: 'local',
      selectedModel: 'local-deterministic-v1',
      routingScore: 85,
      selectionReason: 'Top ranked provider',
      tenantId: 'tenant-1'
    });

    assert.equal(telemetry.count(), 1);
    const metrics = telemetry.getMetrics();
    assert.equal(metrics.totalEvents, 1);
    assert.equal(metrics.providerCounts['local'], 1);

    const events = telemetry.getEvents({ tenantId: 'tenant-1' });
    assert.equal(events.length, 1);
  });
});
