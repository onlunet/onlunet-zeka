/**
 * ONLUNET ZEKA - FAZ 65 Audit Trail & Zero Leakage Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createAuditLedger, AuditEventTypes } from '../src/control-plane/audit-ledger.js';

describe('FAZ 65.18: Audit Trail Integrity & Zero Secret Redaction', () => {
  it('records lifecycle audit events without storing raw Authorization Bearer tokens', () => {
    const ledger = createAuditLedger();

    ledger.record({
      eventType: AuditEventTypes.AI_INVOCATION_STARTED,
      taskId: 'task-audit-1',
      tenantId: 'tenant-sec',
      details: {
        authorizationHeader: 'Bearer sk-proj-1234567890abcdef',
        taskType: 'CODING'
      }
    });

    const events = ledger.getEvents({ tenantId: 'tenant-sec' });
    assert.strictEqual(events.length, 1);

    const serialized = JSON.stringify(events[0]);
    assert.strictEqual(serialized.includes('sk-proj-1234567890abcdef'), false);
    assert.ok(serialized.includes('[REDACTED]'));
  });
});
