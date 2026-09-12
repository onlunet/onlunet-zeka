/**
 * ONLUNET ZEKA - Distributed Trace & Correlation Manager
 * FAZ 59 Foundation: End-to-End Execution Traceability
 *
 * Implements:
 * - Deterministic trace context generation
 * - Span hierarchy across the 11-step pipeline
 * - Correlation propagation without authority leakage
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import crypto from 'node:crypto';

export function createTraceContext({
  traceId = null,
  spanId = null,
  parentSpanId = null,
  invocationId = null,
  agentId = 'agent-default',
  providerId = 'local',
  model = 'default',
  tenantId = 'default-tenant',
  workspaceId = 'default-workspace',
  taskId = null,
  step = 'REQUEST'
} = {}) {
  const activeTraceId = traceId || `trc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const activeSpanId = spanId || `spn-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  return Object.freeze({
    traceId: activeTraceId,
    spanId: activeSpanId,
    parentSpanId,
    invocationId,
    agentId,
    providerId,
    model,
    tenantId,
    workspaceId,
    taskId,
    step,
    timestamp: new Date().toISOString(),

    /**
     * Creates a child span inheriting traceId, tenantId, workspaceId, and taskId.
     */
    createChildSpan({ step: childStep, agentId: childAgentId, providerId: childProviderId } = {}) {
      return createTraceContext({
        traceId: activeTraceId,
        parentSpanId: activeSpanId,
        invocationId,
        agentId: childAgentId || agentId,
        providerId: childProviderId || providerId,
        model,
        tenantId,
        workspaceId,
        taskId,
        step: childStep || step
      });
    }
  });
}
