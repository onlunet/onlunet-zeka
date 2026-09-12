/**
 * ONLUNET ZEKA - FAZ 64 OpenAI Telemetry & Observability Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createRoutingTelemetry } from '../src/providers/routing-telemetry.js';

describe('FAZ 64.17: OpenAI Observability & Zero Secret Leakage', () => {
  it('logs telemetry events without recording Authorization headers or Bearer tokens', () => {
    const tel = createRoutingTelemetry();
    tel.record({
      taskType: 'CODING',
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o-mini',
      routingScore: 90,
      selectionReason: 'Preferred provider selected'
    });

    const events = tel.getEvents();
    assert.equal(events.length, 1);
    const serialized = JSON.stringify(events[0]);
    assert.ok(!serialized.includes('Bearer'));
    assert.ok(!serialized.includes('Authorization'));
    assert.ok(!serialized.includes('sk-'));
  });
});
