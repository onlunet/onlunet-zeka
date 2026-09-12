/**
 * AI Development OS - Execution Handoff / Runtime Contract Foundation
 * Phase 8 - Pure Declarative Runtime Handoff Envelope
 *
 * HANDOFF != EXECUTION
 * RUNTIME CONTRACT != RUNTIME
 * HANDOFF != QUEUE
 * HANDOFF != DISPATCH
 * ZERO REAL EXECUTION / ZERO SHELL / ZERO PROCESS SPAWN / ZERO AI / STRICT SCOPE LOCK
 */
import { ErrorCodes } from './constants.js';
import { AdmissionDecision } from './preflight.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates an immutable Execution Handoff Contract envelope.
 * Strictly requires an AdmissionResult with decision === 'ALLOWED'.
 * Packages pre-approved declarative references for future runtime consumption.
 *
 * Exposes NO executable or transport methods (run, execute, dispatch, spawn, queue, submit).
 */
export function createExecutionHandoffContract({
  id,
  taskId,
  planId,
  admissionResult,
  workingDirectory = '',
  expectedCommands = [],
  policyReferences = [],
  executionBoundaryReference = null,
  scopeReference = null
}) {
  validateRequired({ id, taskId, planId, admissionResult }, ['id', 'taskId', 'planId', 'admissionResult'], 'ExecutionHandoffContract');

  // Strict Admission Gate: Only AdmissionDecision.ALLOWED can produce a Handoff Contract
  if (admissionResult.decision !== AdmissionDecision.ALLOWED) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Cannot create ExecutionHandoffContract: admission decision is '${admissionResult.decision}'. Admission must be ALLOWED.`);
  }

  // Cross-reference integrity check
  if (admissionResult.taskId !== taskId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] AdmissionResult taskId '${admissionResult.taskId}' does not match Handoff taskId '${taskId}'`);
  }

  if (admissionResult.planId !== planId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] AdmissionResult planId '${admissionResult.planId}' does not match Handoff planId '${planId}'`);
  }

  if (!Array.isArray(expectedCommands)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] expectedCommands must be an array`);
  }

  if (!Array.isArray(policyReferences)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] policyReferences must be an array`);
  }

  return Object.freeze({
    id,
    taskId,
    planId,
    admissionId: admissionResult.id,
    workingDirectory,
    expectedCommands: Object.freeze([...expectedCommands]),
    policyReferences: Object.freeze([...policyReferences]),
    executionBoundaryReference,
    scopeReference
  });
}
