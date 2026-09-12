/**
 * AI Development OS - Runtime Consumption / Execution Engine Boundary Foundation
 * Phase 9 - Pure Declarative Execution Request & Runtime Boundary Contract
 *
 * RUNTIME CONSUMPTION != REAL EXECUTION
 * EXECUTION REQUEST != EXECUTION PROCESS
 * ENGINE BOUNDARY != ENGINE IMPLEMENTATION
 * REQUEST != EXECUTION RESULT
 * ZERO REAL EXECUTION / ZERO PROCESS / ZERO SHELL / ZERO WORKER / ZERO QUEUE / STRICT SCOPE LOCK
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
 * Creates an immutable, declarative ExecutionRequest contract.
 * Represents the finalized declarative execution request consumed across the engine boundary.
 *
 * Exposes NO executable methods, process handles, queues, or callbacks.
 */
export function createExecutionRequestContract({
  id,
  taskId,
  planId,
  admissionId,
  handoffId,
  handoffReference
}) {
  validateRequired({ id, taskId, planId, admissionId, handoffId, handoffReference },
    ['id', 'taskId', 'planId', 'admissionId', 'handoffId', 'handoffReference'],
    'ExecutionRequestContract'
  );

  // Identity Integrity Checks
  if (handoffReference.id !== handoffId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff reference id '${handoffReference.id}' does not match handoffId '${handoffId}'`);
  }
  if (handoffReference.taskId !== taskId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff reference taskId '${handoffReference.taskId}' does not match taskId '${taskId}'`);
  }
  if (handoffReference.planId !== planId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff reference planId '${handoffReference.planId}' does not match planId '${planId}'`);
  }
  if (handoffReference.admissionId !== admissionId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff reference admissionId '${handoffReference.admissionId}' does not match admissionId '${admissionId}'`);
  }

  return Object.freeze({
    id,
    taskId,
    planId,
    admissionId,
    handoffId,
    // Pure declarative reference to authoritative handoff
    handoffReference
  });
}

/**
 * Runtime Consumption Boundary.
 * Consumes an ExecutionHandoffContract and an AdmissionResult to produce a validated ExecutionRequest.
 * Enforces:
 * 1. Admission must be ALLOWED
 * 2. Identity chain integrity (Task -> Plan -> Admission -> Handoff)
 * 3. Zero duplication of authoritative command/policy fields (delegated to handoffReference)
 *
 * Side-effect free, deterministic, NO process execution.
 */
export function consumeExecutionHandoff({
  requestId,
  handoff,
  admissionResult
}) {
  validateRequired({ requestId, handoff, admissionResult }, ['requestId', 'handoff', 'admissionResult'], 'consumeExecutionHandoff');

  // Strict Admission Gate
  if (admissionResult.decision !== AdmissionDecision.ALLOWED) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Cannot consume handoff: Admission decision is '${admissionResult.decision}'. Must be ALLOWED.`);
  }

  // Cross-reference integrity between handoff and admission
  if (handoff.admissionId !== admissionResult.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff admissionId '${handoff.admissionId}' does not match AdmissionResult id '${admissionResult.id}'`);
  }
  if (handoff.taskId !== admissionResult.taskId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff taskId '${handoff.taskId}' does not match AdmissionResult taskId '${admissionResult.taskId}'`);
  }
  if (handoff.planId !== admissionResult.planId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Handoff planId '${handoff.planId}' does not match AdmissionResult planId '${admissionResult.planId}'`);
  }

  return createExecutionRequestContract({
    id: requestId,
    taskId: handoff.taskId,
    planId: handoff.planId,
    admissionId: admissionResult.id,
    handoffId: handoff.id,
    handoffReference: handoff
  });
}
