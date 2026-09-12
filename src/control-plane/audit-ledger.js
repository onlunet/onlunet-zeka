/**
 * ONLUNET ZEKA - Append-Only Control Plane Audit Ledger
 * FAZ 59 Foundation: Forensic Audit Trail & Event Lineage
 *
 * Implements:
 * - Immutable, append-only event stream
 * - Complete lifecycle event types (24+ events)
 * - Automatic secret scrubbing (API keys, tokens, passwords)
 * - Zero authority guarantee: Audit records never grant authority.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import crypto from 'node:crypto';
import { sanitizeString } from '../providers/credential-sanitizer.js';

export const AuditEventTypes = Object.freeze({
  AI_INVOCATION_STARTED: 'AI_INVOCATION_STARTED',
  AI_INVOCATION_COMPLETED: 'AI_INVOCATION_COMPLETED',
  AI_INVOCATION_FAILED: 'AI_INVOCATION_FAILED',
  PROVIDER_SELECTED: 'PROVIDER_SELECTED',
  PROVIDER_FALLBACK: 'PROVIDER_FALLBACK',
  PROVIDER_CIRCUIT_OPENED: 'PROVIDER_CIRCUIT_OPENED',
  AGENT_STARTED: 'AGENT_STARTED',
  AGENT_COMPLETED: 'AGENT_COMPLETED',
  AGENT_FAILED: 'AGENT_FAILED',
  PROPOSAL_CREATED: 'PROPOSAL_CREATED',
  PROPOSAL_REVIEWED: 'PROPOSAL_REVIEWED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  CONFLICT_RESOLVED: 'CONFLICT_RESOLVED',
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  ADMISSION_GRANTED: 'ADMISSION_GRANTED',
  ADMISSION_REJECTED: 'ADMISSION_REJECTED',
  EXECUTION_STARTED: 'EXECUTION_STARTED',
  EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  VERIFICATION_STARTED: 'VERIFICATION_STARTED',
  VERIFICATION_PASSED: 'VERIFICATION_PASSED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  SELF_CORRECTION_STARTED: 'SELF_CORRECTION_STARTED',
  SELF_CORRECTION_STOPPED: 'SELF_CORRECTION_STOPPED'
});

export function createAuditLedger({ maxEvents = 10000 } = {}) {
  const events = [];

  function sanitizeMetadata(data) {
    if (!data || typeof data !== 'object') {
      return typeof data === 'string' ? sanitizeString(data) : data;
    }
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (/key|secret|token|password|auth|authorization/i.test(k)) {
        clean[k] = '[REDACTED]';
      } else if (typeof v === 'string') {
        clean[k] = sanitizeString(v);
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = sanitizeMetadata(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  return Object.freeze({
    record({
      eventType,
      traceId = null,
      spanId = null,
      taskId = null,
      tenantId = 'default-tenant',
      workspaceId = 'default-workspace',
      agentId = null,
      providerId = null,
      details = {}
    } = {}) {
      if (!AuditEventTypes[eventType]) {
        throw new Error(`Invalid audit event type: ${eventType}`);
      }

      const event = Object.freeze({
        eventId: `evt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        index: events.length,
        eventType,
        traceId,
        spanId,
        taskId,
        tenantId,
        workspaceId,
        agentId,
        providerId,
        details: Object.freeze(sanitizeMetadata(details)),
        executionAuthorized: false, // Inviolable guarantee
        timestamp: new Date().toISOString()
      });

      if (events.length >= maxEvents) {
        events.shift(); // Bounded memory FIFO
      }
      events.push(event);

      return event;
    },

    getEvents({ tenantId = null, taskId = null, traceId = null, limit = 100 } = {}) {
      let filtered = events;
      if (tenantId) {
        filtered = filtered.filter(e => e.tenantId === tenantId);
      }
      if (taskId) {
        filtered = filtered.filter(e => e.taskId === taskId);
      }
      if (traceId) {
        filtered = filtered.filter(e => e.traceId === traceId);
      }
      return filtered.slice(-limit);
    },

    count() {
      return events.length;
    }
  });
}
