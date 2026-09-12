/**
 * AI Development OS - Execution Planning Contract Foundation
 * Phase 3 - Pure Descriptive Planned Execution Unit Contract
 *
 * ZERO REAL EXECUTION / ZERO LIVE AI / ZERO DATABASE / STRICT SCOPE LOCK
 */
import { ErrorCodes } from './constants.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates a descriptive, immutable execution plan contract.
 * Represents a planned execution unit referencing tasks, steps, commands, files,
 * evidence, validations, approvals, policies, scopes, boundaries, and preconditions.
 *
 * Exposes NO executable methods (run, execute, dispatch, spawn, fork, queue, schedule).
 */
export function createExecutionPlanContract({
  id,
  taskId,
  steps = [],
  expectedCommands = [],
  expectedFileChanges = [],
  expectedEvidence = [],
  expectedValidation = [],
  requiredApprovals = [],
  policyReferences = [],
  scopeReference = null,
  executionBoundaryReference = null,
  preconditions = [],
  risk = 'LOW'
}) {
  validateRequired({ id, taskId }, ['id', 'taskId'], 'ExecutionPlanContract');

  // Validate array fields if provided
  const arrayFields = [
    { name: 'steps', val: steps },
    { name: 'expectedCommands', val: expectedCommands },
    { name: 'expectedFileChanges', val: expectedFileChanges },
    { name: 'expectedEvidence', val: expectedEvidence },
    { name: 'expectedValidation', val: expectedValidation },
    { name: 'requiredApprovals', val: requiredApprovals },
    { name: 'policyReferences', val: policyReferences },
    { name: 'preconditions', val: preconditions }
  ];

  for (const { name, val } of arrayFields) {
    if (!Array.isArray(val)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ExecutionPlanContract field '${name}' must be an array`);
    }
  }

  // Validate risk matches existing project terminology
  const allowedRisks = ['LOW', 'MEDIUM', 'HIGH'];
  if (!allowedRisks.includes(risk)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid risk level '${risk}'. Must be one of: ${allowedRisks.join(', ')}`);
  }

  return Object.freeze({
    id,
    taskId,
    steps: Object.freeze([...steps]),
    expectedCommands: Object.freeze([...expectedCommands]),
    expectedFileChanges: Object.freeze([...expectedFileChanges]),
    expectedEvidence: Object.freeze([...expectedEvidence]),
    expectedValidation: Object.freeze([...expectedValidation]),
    requiredApprovals: Object.freeze([...requiredApprovals]),
    policyReferences: Object.freeze([...policyReferences]),
    scopeReference,
    executionBoundaryReference,
    preconditions: Object.freeze([...preconditions]),
    risk
  });
}
