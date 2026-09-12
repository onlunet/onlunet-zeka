/**
 * AI Development OS - Declarative Autonomous Policy Contract & Evaluation Foundation
 * Phase 43 - Bounded Autonomous Admission Decision Foundation
 *
 * CORE INVARIANTS:
 * 1. AUTONOMY != AUTHORITY
 * 2. POLICY != AUTHORITY
 * 3. POLICY MAY RESTRICT AUTHORITY, BUT MUST NEVER EXPAND AUTHORITY.
 * 4. Policy evaluation produces ADMIT or REJECT.
 * 5. Policy ADMIT alone confers ZERO execution or mutation authority.
 * 6. Policy ADMIT MUST still pass the authoritative WorkUnit Admission Gate.
 * 7. Zero JobState / TaskState mutation during policy evaluation.
 * 8. Zero WorkUnit mutation during policy evaluation.
 * 9. Fail-closed: missing policy, malformed policy, or undefined budgets fail-closed.
 * 10. Zero loops / Zero queues / Zero worker pools / Zero background services.
 */
import path from 'node:path';
import { ErrorCodes, WorkUnitActionType } from './constants.js';
import { isPathInsideDirectory } from '../interfaces/core.js';

export const AutonomousPolicyDecision = Object.freeze({
  ADMIT: 'ADMIT',
  REJECT: 'REJECT'
});

export const AutonomousMode = Object.freeze({
  STRICT: 'STRICT',
  SUPERVISED: 'SUPERVISED'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates an immutable, declarative AutonomousPolicyContract.
 * Enforces explicit bounds and fail-closed defaults.
 */
export function createAutonomousPolicyContract({
  id,
  tenantId,
  jobId = null,
  taskId = null,
  planId = null,
  workspaceRoot = null,
  mode = AutonomousMode.STRICT,
  allowedActionTypes = Object.freeze([WorkUnitActionType.COMMAND, WorkUnitActionType.MUTATION]),
  deniedActionTypes = Object.freeze([]),
  allowedCommandPatterns = Object.freeze([]),
  deniedCommandPatterns = Object.freeze([]),
  allowedTargetPatterns = Object.freeze([]),
  deniedTargetPatterns = Object.freeze([]),
  maxExecutions = 1,
  maxMutations = 1,
  maxCommands = 1,
  requireUserApproval = false,
  metadata = Object.freeze({})
}) {
  validateRequired({ id, tenantId }, ['id', 'tenantId'], 'AutonomousPolicyContract');

  if (!Object.values(AutonomousMode).includes(mode)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid AutonomousMode: ${mode}`);
  }

  // Budget validation: undefined != unlimited. Must be non-negative finite integer.
  if (!Number.isInteger(maxExecutions) || maxExecutions < 0) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] maxExecutions must be a non-negative integer`);
  }
  if (!Number.isInteger(maxMutations) || maxMutations < 0) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] maxMutations must be a non-negative integer`);
  }
  if (!Number.isInteger(maxCommands) || maxCommands < 0) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] maxCommands must be a non-negative integer`);
  }

  return Object.freeze({
    id: String(id).trim(),
    tenantId: String(tenantId).trim(),
    jobId: jobId ? String(jobId).trim() : null,
    taskId: taskId ? String(taskId).trim() : null,
    planId: planId ? String(planId).trim() : null,
    workspaceRoot: workspaceRoot ? path.resolve(String(workspaceRoot).trim()) : null,
    mode,
    allowedActionTypes: Object.freeze([...allowedActionTypes]),
    deniedActionTypes: Object.freeze([...deniedActionTypes]),
    allowedCommandPatterns: Object.freeze([...allowedCommandPatterns]),
    deniedCommandPatterns: Object.freeze([...deniedCommandPatterns]),
    allowedTargetPatterns: Object.freeze([...allowedTargetPatterns]),
    deniedTargetPatterns: Object.freeze([...deniedTargetPatterns]),
    maxExecutions,
    maxMutations,
    maxCommands,
    requireUserApproval: Boolean(requireUserApproval),
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Deterministically evaluates a WorkUnit against an AutonomousPolicyContract and current execution budget.
 *
 * Rules:
 * 1. Missing or malformed inputs -> REJECT.
 * 2. Tenant mismatch -> REJECT.
 * 3. Scoped Job/Task/Plan/Workspace mismatch -> REJECT.
 * 4. Action type disallowed or explicitly denied -> REJECT.
 * 5. Budget exhausted (executedCount >= maxExecutions, commands >= maxCommands, mutations >= maxMutations) -> REJECT.
 * 6. WorkUnit and Policy are strictly unmutated.
 * 7. Decision is strictly ADMIT or REJECT.
 */
export function evaluateAutonomousPolicy({
  policy,
  workUnit,
  currentExecutions = 0,
  currentCommands = 0,
  currentMutations = 0
}) {
  if (!policy || typeof policy !== 'object') {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'Missing or malformed autonomous policy',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (!workUnit || typeof workUnit !== 'object') {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'Missing or malformed work unit',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  // Type confusion & negative/NaN counter check (fail-closed)
  if (!Number.isInteger(currentExecutions) || currentExecutions < 0) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'currentExecutions must be a non-negative integer',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }
  if (!Number.isInteger(currentCommands) || currentCommands < 0) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'currentCommands must be a non-negative integer',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }
  if (!Number.isInteger(currentMutations) || currentMutations < 0) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'currentMutations must be a non-negative integer',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 1. Tenant boundary enforcement
  if (policy.tenantId !== workUnit.tenantId) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Policy tenantId '${policy.tenantId}' does not match WorkUnit tenantId '${workUnit.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 2. Scoped Job ID matching (if policy is job-scoped)
  if (policy.jobId && policy.jobId !== workUnit.jobId) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Policy jobId '${policy.jobId}' does not match WorkUnit jobId '${workUnit.jobId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 3. Scoped Task ID matching (if policy is task-scoped)
  if (policy.taskId && policy.taskId !== workUnit.taskId) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Policy taskId '${policy.taskId}' does not match WorkUnit taskId '${workUnit.taskId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 4. Scoped Plan ID matching (if policy is plan-scoped)
  if (policy.planId && policy.planId !== workUnit.planId) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Policy planId '${policy.planId}' does not match WorkUnit planId '${workUnit.planId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 5. Scoped Workspace matching (if policy specifies workspaceRoot)
  if (policy.workspaceRoot) {
    const resolvedWuWs = path.resolve(workUnit.workspaceRoot || '');
    if (policy.workspaceRoot !== resolvedWuWs) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Policy workspaceRoot '${policy.workspaceRoot}' does not match WorkUnit workspace '${resolvedWuWs}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }
  }

  // 6. Action type validation
  const action = workUnit.action;
  if (!action || !action.type) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: 'WorkUnit action is missing or invalid',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (policy.deniedActionTypes.includes(action.type)) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Action type '${action.type}' is explicitly denied by Autonomous Policy`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (!policy.allowedActionTypes.includes(action.type)) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Action type '${action.type}' is not allowed by Autonomous Policy`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  // 7. Budget evaluation
  if (currentExecutions >= policy.maxExecutions) {
    return Object.freeze({
      decision: AutonomousPolicyDecision.REJECT,
      reason: `Execution budget exhausted (${currentExecutions}/${policy.maxExecutions})`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (action.type === WorkUnitActionType.COMMAND) {
    if (currentCommands >= policy.maxCommands) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Command budget exhausted (${currentCommands}/${policy.maxCommands})`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }

    // Command specific restrictions
    if (policy.deniedCommandPatterns.some(pat => action.command.includes(pat))) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Command contains denied pattern: '${action.command}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }

    if (policy.allowedCommandPatterns.length > 0 && !policy.allowedCommandPatterns.some(pat => action.command.startsWith(pat))) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Command does not match allowed command patterns: '${action.command}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }
  } else if (action.type === WorkUnitActionType.MUTATION) {
    if (currentMutations >= policy.maxMutations) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Mutation budget exhausted (${currentMutations}/${policy.maxMutations})`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }

    // Path containment evaluation
    const target = action.targetPath;
    if (!target) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: 'Mutation action is missing targetPath',
        code: ErrorCodes.INVALID_CONTRACT,
        evaluatedAt: new Date().toISOString()
      });
    }

    const resolvedTarget = path.resolve(workUnit.workspaceRoot, target);
    if (!isPathInsideDirectory(resolvedTarget, workUnit.workspaceRoot)) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Mutation target '${target}' escapes workspace boundary`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }

    if (policy.deniedTargetPatterns.some(pat => target.includes(pat))) {
      return Object.freeze({
        decision: AutonomousPolicyDecision.REJECT,
        reason: `Mutation target matches denied pattern: '${target}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }
  }

  // All policy rules satisfied -> ADMIT
  return Object.freeze({
    decision: AutonomousPolicyDecision.ADMIT,
    reason: 'Compliant with declarative autonomous policy',
    policyId: policy.id,
    workUnitId: workUnit.id,
    evaluatedAt: new Date().toISOString()
  });
}
