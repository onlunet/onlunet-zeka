/**
 * AI Development OS - Final Execution Authorization Boundary Foundation
 * Phase 10 & Phase 11.1 - Pure Declarative Execution Authorization Contract
 *
 * AUTHORIZATION != EXECUTION
 * AUTHORIZATION != RUNTIME
 * AUTHORIZATION != EXECUTION RESULT
 * AUTHORIZED EXECUTION CONTEXT == ACTUALLY CONSUMED EXECUTION CONTEXT
 * ZERO REAL EXECUTION / ZERO PROCESS / ZERO SHELL / ZERO WORKER / ZERO QUEUE / STRICT SCOPE LOCK
 */
import { ErrorCodes } from './constants.js';
import { AdmissionDecision } from './preflight.js';

export const AuthorizationDecision = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  DENIED: 'DENIED'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates an immutable, declarative ExecutionAuthorizationContract.
 * Pure representation of final declarative authorization decision.
 *
 * Exposes NO executable methods (run, execute, dispatch, spawn, fork, queue, shell, etc.).
 * Carries NO execution result fields (exitCode, stdout, stderr, processId, etc.).
 * Binds immutable authorized context to prevent ID-only forged replacement.
 */
export function createExecutionAuthorizationContract({
  id,
  requestId,
  taskId,
  planId,
  admissionId,
  handoffId,
  decision,
  reason,
  code = null,
  authorizedContext = null
}) {
  validateRequired(
    { id, requestId, taskId, planId, admissionId, handoffId, decision, reason },
    ['id', 'requestId', 'taskId', 'planId', 'admissionId', 'handoffId', 'decision', 'reason'],
    'ExecutionAuthorizationContract'
  );

  if (!Object.values(AuthorizationDecision).includes(decision)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid AuthorizationDecision: ${decision}`);
  }

  let frozenContext = null;
  if (authorizedContext) {
    frozenContext = Object.freeze({
      workingDirectory: authorizedContext.workingDirectory,
      expectedCommands: Object.freeze([...(authorizedContext.expectedCommands || [])])
    });
  }

  return Object.freeze({
    id,
    requestId,
    taskId,
    planId,
    admissionId,
    handoffId,
    decision,
    reason,
    code,
    authorizedContext: frozenContext
  });
}

/**
 * Final Declarative Authorization Boundary Evaluator.
 * Evaluates a finalized ExecutionRequest together with its authoritative AdmissionResult.
 *
 * Enforces:
 * 1. Admission exists and decision is strictly ALLOWED (DENIED -> DENIED)
 * 2. Identity chain consistency (Task -> Plan -> Admission -> Handoff -> Request)
 * 3. Handoff reference integrity and context binding (commands and working directory)
 * 4. Produces immutable declarative ExecutionAuthorizationContract binding the authorized context
 *
 * Deterministic, side-effect free, ZERO process execution.
 */
export function authorizeExecutionRequest({
  id,
  executionRequest,
  admissionResult
}) {
  validateRequired({ id, executionRequest }, ['id', 'executionRequest'], 'authorizeExecutionRequest');

  // Check if admission result exists
  if (!admissionResult) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId: executionRequest.taskId,
      planId: executionRequest.planId,
      admissionId: executionRequest.admissionId || 'missing',
      handoffId: executionRequest.handoffId || 'missing',
      decision: AuthorizationDecision.DENIED,
      reason: 'Missing authoritative AdmissionResult',
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Strict Admission Gate: Must be ALLOWED
  if (admissionResult.decision !== AdmissionDecision.ALLOWED) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId: executionRequest.taskId,
      planId: executionRequest.planId,
      admissionId: admissionResult.id,
      handoffId: executionRequest.handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: `Admission decision is '${admissionResult.decision}'. Authorization denied.`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Identity chain integrity checks
  const { taskId, planId, admissionId, handoffId, handoffReference } = executionRequest;

  if (admissionResult.id !== admissionId) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId,
      planId,
      admissionId: admissionResult.id,
      handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: `AdmissionResult id '${admissionResult.id}' does not match request admissionId '${admissionId}'`,
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (admissionResult.taskId !== taskId) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId,
      planId,
      admissionId,
      handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: `AdmissionResult taskId '${admissionResult.taskId}' does not match request taskId '${taskId}'`,
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (admissionResult.planId !== planId) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId,
      planId,
      admissionId,
      handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: `AdmissionResult planId '${admissionResult.planId}' does not match request planId '${planId}'`,
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (!handoffReference || handoffReference.id !== handoffId) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId,
      planId,
      admissionId,
      handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: 'Handoff reference identity mismatch or missing',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (handoffReference.taskId !== taskId || handoffReference.planId !== planId || handoffReference.admissionId !== admissionId) {
    return createExecutionAuthorizationContract({
      id,
      requestId: executionRequest.id,
      taskId,
      planId,
      admissionId,
      handoffId,
      decision: AuthorizationDecision.DENIED,
      reason: 'Handoff cross-reference identity mismatch with request context',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  // Authorized: Binds the authoritative handoff execution context directly into the authorization
  return createExecutionAuthorizationContract({
    id,
    requestId: executionRequest.id,
    taskId,
    planId,
    admissionId,
    handoffId,
    decision: AuthorizationDecision.AUTHORIZED,
    reason: 'Execution request satisfies all authoritative chain identity and admission requirements',
    authorizedContext: {
      workingDirectory: handoffReference.workingDirectory,
      expectedCommands: handoffReference.expectedCommands
    }
  });
}
