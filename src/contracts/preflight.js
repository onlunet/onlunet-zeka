/**
 * AI Development OS - Execution Preflight & Admission Contract Foundation
 * Phase 7 - Pure Declarative Preflight Admission Evaluator
 *
 * Re-uses existing evaluateTaskExecutionEligibility() without duplicating logic.
 * Produces a distinct AdmissionDecision (ALLOWED vs DENIED).
 * Distinct from ExecutionResult (Phase 6 outcome).
 *
 * ADMISSION != EXECUTION
 * PREFLIGHT != EXECUTION ENGINE
 * ZERO REAL EXECUTION / ZERO SHELL / ZERO PROCESS SPAWN / ZERO AI / STRICT SCOPE LOCK
 */
import { ErrorCodes, TaskState } from './constants.js';
import { evaluateTaskExecutionEligibility } from './orchestrator.js';

export const AdmissionDecision = Object.freeze({
  ALLOWED: 'ALLOWED',
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
 * Creates an immutable admission result contract object.
 * Distinct from ExecutionResult (outcome of an execution).
 */
export function createAdmissionResultContract({
  id,
  taskId,
  planId,
  decision,
  reason,
  code = null
}) {
  validateRequired({ id, taskId, planId, decision, reason }, ['id', 'taskId', 'planId', 'decision', 'reason'], 'AdmissionResultContract');

  if (!Object.values(AdmissionDecision).includes(decision)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid AdmissionDecision: ${decision}`);
  }

  return Object.freeze({
    id,
    taskId,
    planId,
    decision,
    reason,
    code
  });
}

/**
 * Evaluates an execution plan for preflight admission.
 * Wraps and invokes existing authoritative eligibility rules (evaluateTaskExecutionEligibility)
 * ensuring zero duplication of policy/scope/approval/boundary logic.
 *
 * Returns an immutable AdmissionResultContract:
 * - decision: ALLOWED | DENIED
 * - reason: string
 * - code: ErrorCode if denied
 */
export function evaluateExecutionPreflight({
  id,
  task,
  executionPlan,
  workingDirectory = '',
  isPrivileged = false,
  scopePolicy,
  executionPolicy,
  securityPolicy,
  approvalPolicy,
  approval = null
}) {
  validateRequired({ id, task, executionPlan }, ['id', 'task', 'executionPlan'], 'evaluateExecutionPreflight');

  // Leverage existing authoritative eligibility evaluation without duplication
  const eligibility = evaluateTaskExecutionEligibility({
    task,
    executionPlan,
    workingDirectory,
    isPrivileged,
    scopePolicy,
    executionPolicy,
    securityPolicy,
    approvalPolicy,
    approval
  });

  const planId = executionPlan.id || 'plan-unknown';

  // Phase 21: Plan ↔ Task Identity Binding Verification
  if (executionPlan.taskId && executionPlan.taskId !== task.id) {
    return createAdmissionResultContract({
      id,
      taskId: task.id,
      planId,
      decision: AdmissionDecision.DENIED,
      reason: `Preflight admission denied: executionPlan taskId '${executionPlan.taskId}' does not match task id '${task.id}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  if (eligibility.eligible && eligibility.status === TaskState.READY) {
    return createAdmissionResultContract({
      id,
      taskId: task.id,
      planId,
      decision: AdmissionDecision.ALLOWED,
      reason: eligibility.reason || 'Task satisfies all preflight admission criteria'
    });
  }

  return createAdmissionResultContract({
    id,
    taskId: task.id,
    planId,
    decision: AdmissionDecision.DENIED,
    reason: eligibility.reason || 'Preflight admission criteria not met',
    code: eligibility.code || ErrorCodes.SECURITY_BLOCKED
  });
}
