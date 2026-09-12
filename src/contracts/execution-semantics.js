/**
 * AI Development OS - Execution Semantics & Result Contract Foundation
 * Phase 6 - Pure Declarative Execution Outcome & Boundary Model
 *
 * ZERO REAL EXECUTION / ZERO SHELL / ZERO PROCESS SPAWN / ZERO AI / STRICT SCOPE LOCK
 */
import { ErrorCodes } from './constants.js';

export const ExecutionOutcome = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates a declarative, immutable execution result contract.
 * Represents the outcome of an execution attempt purely at the contract level.
 *
 * Distinct from:
 * - Execution Process: Does not run or execute commands.
 * - Validation Result: An execution outcome (e.g. SUCCEEDED) does NOT equal validation PASS.
 */
export function createExecutionResultContract({
  id,
  taskId,
  planId,
  outcome = ExecutionOutcome.SUCCEEDED,
  evidenceReferences = [],
  failureReason = null,
  metadata = {}
}) {
  validateRequired({ id, taskId, planId }, ['id', 'taskId', 'planId'], 'ExecutionResultContract');

  if (!Object.values(ExecutionOutcome).includes(outcome)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid ExecutionOutcome: ${outcome}`);
  }

  if (!Array.isArray(evidenceReferences)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] evidenceReferences must be an array`);
  }

  return Object.freeze({
    id,
    taskId,
    planId,
    outcome,
    evidenceReferences: Object.freeze([...evidenceReferences]),
    failureReason,
    metadata: Object.freeze({ ...metadata })
  });
}
