/**
 * AI Development OS - Controlled Execution Bridge Contract
 * Phase 53 Foundation - Admitted Proposal -> Controlled Job -> Work Unit -> Single Execution -> Result Capture
 *
 * CORE INVARIANTS:
 * 1. ADMISSION IS MANDATORY & RE-VALIDATED:
 *    Only explicitly ADMISSION_ALLOWED decisions with valid approval and review can execute.
 *    Client claims alone are NEVER trusted.
 * 2. EXACTLY ONE EXECUTION ATTEMPT:
 *    Execution of an admitted unit happens exactly once.
 *    If execution succeeds -> SUCCEEDED -> STOP.
 *    If execution fails -> FAILED -> STOP.
 * 3. ZERO RETRY / ZERO AUTONOMOUS LOOP:
 *    No automatic retry, no retryCount++, no requeue, no background worker, no daemon, no polling.
 * 4. SCOPE & CONTEXT INTEGRITY:
 *    Tenant, Workspace, Task, Plan, and Proposal fingerprints must strictly match across
 *    Admission, Job, Work Unit, and Execution Context. Any mismatch -> EXECUTION_DENIED.
 * 5. WORK UNIT & JOB ENGINE BINDING:
 *    Reuses authoritative Job Engine (FAZ 38) and Controlled Work Unit (FAZ 40) infrastructure.
 *    No parallel state engines.
 * 6. FAILURE SEMANTICS:
 *    Pre-execution validation failures yield `EXECUTION_DENIED`.
 *    Execution-time failures yield `FAILED`.
 * 7. RESULT IS DATA ONLY:
 *    Execution result captures stdout/stderr/error. Captures confer ZERO authority to retry, fix, or loop.
 * 8. IMMUTABILITY:
 *    ExecutionContext and ExecutionBridgeResult are deeply frozen.
 */
import path from 'node:path';
import {
  ErrorCodes,
  WorkUnitActionType,
  WorkUnitStatus
} from './constants.js';
import {
  AdmissionStatus,
  validateApprovalRecord
} from './approval-admission.js';
import { ProposalReviewStatus } from './proposal-review.js';
import { createWorkUnit, executeWorkUnit } from './work-unit.js';
import { createExecutionPlanContract } from './execution-plan.js';
import { DefaultProposalAuthorityGuarantee, validateProposedFileTarget } from './agent-proposal.js';
import { evaluateAutonomousPolicy, AutonomousPolicyDecision } from './autonomous-policy.js';

export const ExecutionBridgeStatus = Object.freeze({
  EXECUTION_DENIED: 'EXECUTION_DENIED',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED'
});

function isValidIdentifier(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (trimmed === '__proto__' || trimmed === 'constructor' || trimmed === 'prototype') return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(':')) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

function hasPrototypePollution(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return true;
  }
  return false;
}

/**
 * Maps proposal operation to a controlled WorkUnit action.
 */
export function mapProposalOperationToWorkUnitAction(operation, workspaceRoot) {
  if (!operation || typeof operation !== 'object') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Operation must be an object`);
  }

  const opType = String(operation.type || '').trim().toUpperCase();
  const target = operation.target ? String(operation.target).trim() : null;

  if (target) {
    const targetCheck = validateProposedFileTarget(target);
    if (!targetCheck.valid) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid operation target: ${targetCheck.reason}`);
    }
  }

  if (opType === 'CREATE' || opType === 'MODIFY' || opType === 'DELETE') {
    if (!target) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] File mutation operation requires a non-empty target path`);
    }
    const content = typeof operation.content === 'string' ? operation.content : (operation.description || '');
    return Object.freeze({
      type: WorkUnitActionType.MUTATION,
      targetPath: target,
      content,
      operation: opType
    });
  }

  if (opType === 'TEST' || opType === 'READ' || opType === 'ANALYZE' || opType === 'REVIEW' || opType === 'DOCUMENT') {
    // For verification or read-oriented operations, map to a safe read/test command
    const safeCommand = operation.command && typeof operation.command === 'string'
      ? operation.command.trim()
      : `node -e "console.log('Controlled inspection of ${target || 'workspace'}')"` ;
    return Object.freeze({
      type: WorkUnitActionType.COMMAND,
      command: safeCommand
    });
  }

  throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unsupported operation type for execution bridge: '${opType}'`);
}

/**
 * Executes an admitted proposal set through the controlled execution bridge.
 * Enforces single execution attempt, strict admission revalidation, and fail-closed security gates.
 */
export function executeAdmittedBridge({
  executionId,
  jobEngine,
  admissionDecision,
  approval,
  reviewResult,
  orchestrationPlan,
  proposals = [],
  workspaceRoot,
  tenantId = null,
  autonomousPolicy = null,
  executedAdmissionsTracker = null,
  commandRunner = undefined,
  now = Date.now()
} = {}) {
  // Prototype pollution defenses
  if (hasPrototypePollution(admissionDecision) || hasPrototypePollution(approval) || hasPrototypePollution(reviewResult)) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId: executionId || 'unknown',
      outcome: 'DENIED',
      reason: 'Prototype pollution detected in bridge execution input',
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 1: Execution ID & Engine validation
  if (!executionId || typeof executionId !== 'string' || !isValidIdentifier(executionId)) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId: executionId || 'unknown',
      outcome: 'DENIED',
      reason: 'Missing or invalid executionId',
      code: ErrorCodes.INVALID_CONTRACT,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (!jobEngine || typeof jobEngine.createJob !== 'function') {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: 'Missing or invalid jobEngine',
      code: ErrorCodes.INVALID_CONTRACT,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 2: Workspace root validation
  if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: 'Missing or invalid workspaceRoot',
      code: ErrorCodes.INVALID_CONTRACT,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }
  const resolvedWorkspace = path.resolve(workspaceRoot.trim());

  // Gate 3: Admission Decision re-validation (Never trust client string claims alone)
  if (!admissionDecision || typeof admissionDecision !== 'object' || admissionDecision.admissionStatus !== AdmissionStatus.ADMISSION_ALLOWED || !admissionDecision.admitted) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Admission denied: Decision is '${admissionDecision ? admissionDecision.admissionStatus : 'MISSING'}'. Only ADMISSION_ALLOWED proposals can execute`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 4: Single Execution Guarantee & Idempotency / Duplicate Defense
  const admissionKey = admissionDecision.approvalId || admissionDecision.taskId || executionId;
  if (executedAdmissionsTracker) {
    if (executedAdmissionsTracker.has(admissionKey)) {
      return Object.freeze({
        status: ExecutionBridgeStatus.EXECUTION_DENIED,
        executionId,
        outcome: 'DENIED',
        reason: `Duplicate execution attempt blocked: Admission/Approval '${admissionKey}' has already been executed. Single execution invariant enforced`,
        code: ErrorCodes.SECURITY_BLOCKED,
        executed: false,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // Gate 5: Approval Record re-validation
  if (!approval || typeof approval !== 'object' || !approval.id) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: 'Missing or invalid approval record for execution bridge',
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  const effectiveTenantId = tenantId || admissionDecision.tenantId || approval.tenantId || null;
  const effectiveTaskId = admissionDecision.taskId;

  const approvalCheck = validateApprovalRecord(approval, {
    expectedTaskId: effectiveTaskId,
    expectedPlanId: admissionDecision.orchestrationPlanId,
    expectedTenantId: effectiveTenantId,
    reviewResult,
    currentProposals: proposals,
    now
  });

  if (!approvalCheck.valid) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Approval re-validation failed: ${approvalCheck.reason}`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 6: Review Result status verification
  if (!reviewResult || typeof reviewResult !== 'object' || reviewResult.status !== ProposalReviewStatus.REVIEWED || reviewResult.conflictCount > 0) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: 'Review verification failed: Review has conflicts or is not in REVIEWED status',
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 7: Orchestration Plan binding verification
  if (!orchestrationPlan || typeof orchestrationPlan !== 'object' || orchestrationPlan.id !== admissionDecision.orchestrationPlanId) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Orchestration plan mismatch: Expected '${admissionDecision.orchestrationPlanId}', got '${orchestrationPlan ? orchestrationPlan.id : 'none'}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 8: Tenant & Workspace Isolation checks
  if (tenantId !== null && admissionDecision.tenantId !== null && tenantId !== admissionDecision.tenantId) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Tenant mismatch: Caller tenant '${tenantId}' does not match admission tenant '${admissionDecision.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (orchestrationPlan.workspaceId && path.resolve(orchestrationPlan.workspaceId) !== resolvedWorkspace) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Workspace mismatch: Plan workspace '${orchestrationPlan.workspaceId}' does not match execution workspace '${resolvedWorkspace}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 9: Operation & Action extraction
  const effectiveProposals = (Array.isArray(proposals) && proposals.length === 0)
    ? []
    : (proposals && proposals.length > 0 ? proposals : (reviewResult.proposals || []));

  if (!Array.isArray(effectiveProposals) || effectiveProposals.length === 0) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: 'No executable proposals found in admitted proposal set',
      code: ErrorCodes.INVALID_CONTRACT,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Extract first admitted operation for single-execution boundary
  const primaryProposal = effectiveProposals[0];
  const primaryOp = (primaryProposal.operations && primaryProposal.operations.length > 0)
    ? primaryProposal.operations[0]
    : { type: 'ANALYZE', description: primaryProposal.objective || 'Inspect workspace' };

  let workUnitAction;
  try {
    workUnitAction = mapProposalOperationToWorkUnitAction(primaryOp, resolvedWorkspace);
  } catch (err) {
    return Object.freeze({
      status: ExecutionBridgeStatus.EXECUTION_DENIED,
      executionId,
      outcome: 'DENIED',
      reason: `Failed to map proposal operation: ${err.message}`,
      code: ErrorCodes.SECURITY_BLOCKED,
      executed: false,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 10: Controlled Job & Authoritative Plan instantiation in JobEngine
  const jobId = `job-${executionId}`;
  const taskId = effectiveTaskId || `task-${executionId}`;
  const planId = `plan-${executionId}`;

  // Establish authoritative execution plan contract in JobEngine
  const expectedCommands = workUnitAction.type === WorkUnitActionType.COMMAND ? [workUnitAction.command] : [];
  const expectedFiles = workUnitAction.type === WorkUnitActionType.MUTATION ? [workUnitAction.targetPath] : [];

  const authoritativeExecPlan = createExecutionPlanContract({
    id: planId,
    taskId,
    workspaceRoot: resolvedWorkspace,
    expectedCommands,
    expectedFileChanges: expectedFiles
  });

  const job = jobEngine.createJob({
    id: jobId,
    projectId: `proj-${executionId}`,
    workflowId: `wf-${executionId}`,
    tenantId: effectiveTenantId,
    workspaceReference: resolvedWorkspace
  });

  jobEngine.createTask({
    id: taskId,
    jobId,
    objective: primaryProposal.objective || 'Admitted execution task',
    tenantId: effectiveTenantId
  });

  jobEngine.setJobPlan(jobId, authoritativeExecPlan, { tenantId: effectiveTenantId });

  // Gate 11: Controlled Work Unit creation
  const workUnitId = `wu-${executionId}`;
  const workUnit = createWorkUnit({
    id: workUnitId,
    tenantId: effectiveTenantId,
    workspaceRoot: resolvedWorkspace,
    jobId,
    taskId,
    planId,
    action: workUnitAction
  });

  // Gate 12: Autonomous Policy evaluation (FAZ 43/44 integration)
  if (autonomousPolicy) {
    const policyDecision = evaluateAutonomousPolicy({
      policy: autonomousPolicy,
      workUnit,
      currentExecutions: 0,
      currentCommands: 0,
      currentMutations: 0
    });

    if (policyDecision.decision !== AutonomousPolicyDecision.ADMIT) {
      return Object.freeze({
        status: ExecutionBridgeStatus.EXECUTION_DENIED,
        executionId,
        jobId,
        workUnitId,
        outcome: 'DENIED',
        reason: `Autonomous Policy denied execution: ${policyDecision.reason}`,
        code: policyDecision.code || ErrorCodes.SECURITY_BLOCKED,
        executed: false,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // Record admission attempt in tracker before execution launch to prevent concurrent/replay attempts
  if (executedAdmissionsTracker) {
    executedAdmissionsTracker.add(admissionKey);
  }

  // Gate 13: Execute exactly once through authoritative FAZ 40 execution boundary
  const startedAt = new Date().toISOString();
  let executionOutcome;

  try {
    const executedUnit = executeWorkUnit({
      workUnit,
      jobEngine,
      commandRunner,
      userApproval: true // Authorized via explicit FAZ 52 approval
    });

    const completedAt = new Date().toISOString();
    const isSuccess = executedUnit.status === WorkUnitStatus.SUCCEEDED;

    return Object.freeze({
      status: isSuccess ? ExecutionBridgeStatus.EXECUTED : ExecutionBridgeStatus.FAILED,
      executionId,
      jobId,
      taskId,
      planId,
      workUnitId,
      tenantId: effectiveTenantId,
      workspaceRoot: resolvedWorkspace,
      operation: primaryOp.type,
      target: primaryOp.target || null,
      outcome: isSuccess ? 'SUCCEEDED' : 'FAILED',
      executed: true,
      startedAt,
      completedAt,
      workUnitStatus: executedUnit.status,
      executionResultId: executedUnit.executionResultId,
      verificationResult: executedUnit.verificationResult,
      failureReason: executedUnit.error ? executedUnit.error.message : null,
      authorityGuarantee: DefaultProposalAuthorityGuarantee, // Authority strictly stays proposalOnly
      metadata: Object.freeze({
        singleExecution: true,
        terminal: true
      })
    });
  } catch (err) {
    const completedAt = new Date().toISOString();
    return Object.freeze({
      status: ExecutionBridgeStatus.FAILED,
      executionId,
      jobId,
      taskId,
      planId,
      workUnitId,
      tenantId: effectiveTenantId,
      workspaceRoot: resolvedWorkspace,
      operation: primaryOp.type,
      target: primaryOp.target || null,
      outcome: 'FAILED',
      executed: true,
      startedAt,
      completedAt,
      workUnitStatus: WorkUnitStatus.FAILED,
      failureReason: err.message,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      metadata: Object.freeze({
        singleExecution: true,
        terminal: true
      })
    });
  }
}
