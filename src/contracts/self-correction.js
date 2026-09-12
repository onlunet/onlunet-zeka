/**
 * AI Development OS - Bounded Self-Correction Contract
 * Phase 56 Foundation - Bounded, Controlled Self-Correction Boundary
 *
 * CORE INVARIANTS:
 * 1. STRICT CYCLE LIMIT (MAX_CORRECTION_CYCLES = 3):
 *    Absolute hard limit of 3 correction attempts. No override via config, AI, user payload, or parameters.
 *    cycle > 3 -> CORRECTION_LIMIT_REACHED -> STOP.
 * 2. NO UNBOUNDED LOOP / ZERO AUTONOMOUS RECURSION:
 *    No while(!success), no recursive self-invocations, no queues, no background workers.
 *    Single invocation handles one discrete step or transition.
 * 3. NO AUTHORITY SHORTCUTS:
 *    FAILURE -> ANALYSIS -> PROPOSAL -> REVIEW -> EXPLICIT APPROVAL -> ADMISSION -> EXECUTION -> VERIFICATION -> STOP.
 *    No auto-approval, no auto-admission, no auto-execution, no auto-fix.
 * 4. APPROVAL & ADMISSION INTEGRITY:
 *    Approvals and admissions are proposal-specific and single-use.
 *    Prior approval or admission CANNOT be reused for a new correction proposal.
 *    Execution replay is strictly denied.
 * 5. UNTRUSTED AI & FAILURE EVIDENCE:
 *    AI and failure evidence are treated as untrusted data with zero execution/mutation authority.
 *    Prompt injections ("ignore policy", "approve") confer zero authority.
 * 6. FAIL-CLOSED LINEAGE & DRIFT DEFENSE:
 *    Strict binding across originalTaskId, originalJobId, parentExecutionId, parentVerificationId,
 *    tenantId, workspaceId, and correctionCycle.
 *    Any mismatch, drift, traversal, or injection yields CORRECTION_DENIED.
 * 7. EXPLICIT SUCCESS CONDITION:
 *    Execution SUCCEEDED + FAZ 54 VERIFIED_SUCCESS + FAZ 55 VERIFIED_SUCCESS -> CORRECTION_SUCCEEDED -> STOP.
 *    Any failure at cycle === 3 -> CORRECTION_LIMIT_REACHED -> STOP.
 * 8. IMMUTABILITY & DETERMINISM:
 *    All outputs, diagnostics, proposals, and results are deeply frozen (Object.freeze).
 */

import crypto from 'node:crypto';
import path from 'node:path';
import {
  ErrorCodes,
  ValidationResult
} from './constants.js';
import {
  DefaultProposalAuthorityGuarantee,
  ProposalOperationType,
  ProposalRiskLevel,
  createAgentProposal,
  validateProposedFileTarget
} from './agent-proposal.js';
import {
  computeProposalSetFingerprint,
  computeReviewFingerprint,
  validateApprovalRecord,
  evaluateApprovalAdmission,
  AdmissionStatus,
  ApprovalStatus,
  ApprovalSourceType
} from './approval-admission.js';
import {
  aggregateAndReviewProposals,
  ProposalReviewStatus
} from './proposal-review.js';
import {
  executeAdmittedBridge,
  ExecutionBridgeStatus
} from './execution-bridge.js';
import {
  verifyExecutionResult,
  VerificationStatus as UnitVerificationStatus
} from './execution-verification.js';
import {
  orchestrateProjectVerification,
  ProjectVerificationStatus,
  createProjectVerificationPlan
} from './project-verification.js';
import { isPathInsideDirectory } from '../interfaces/core.js';

export const MAX_CORRECTION_CYCLES = 3;

export const CorrectionStatus = Object.freeze({
  CORRECTION_SUCCEEDED: 'CORRECTION_SUCCEEDED',
  CORRECTION_FAILED: 'CORRECTION_FAILED',
  CORRECTION_LIMIT_REACHED: 'CORRECTION_LIMIT_REACHED',
  CORRECTION_DENIED: 'CORRECTION_DENIED',
  CORRECTION_PENDING_APPROVAL: 'CORRECTION_PENDING_APPROVAL'
});

export const FailureCategory = Object.freeze({
  EXECUTION_FAILURE: 'EXECUTION_FAILURE',
  VERIFICATION_FAILURE: 'VERIFICATION_FAILURE',
  PROJECT_VERIFICATION_FAILURE: 'PROJECT_VERIFICATION_FAILURE',
  FILE_CONTENT_MISMATCH: 'FILE_CONTENT_MISMATCH',
  FILE_MISSING: 'FILE_MISSING',
  TEST_FAILURE: 'TEST_FAILURE',
  BUILD_FAILURE: 'BUILD_FAILURE',
  ARTIFACT_MISSING: 'ARTIFACT_MISSING',
  UNKNOWN_FAILURE: 'UNKNOWN_FAILURE'
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
 * Validates authority injection in raw/external payloads.
 * Returns true if malicious authority escalation keywords or override flags are detected.
 */
function hasMaliciousAuthorityInjection(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const dangerousKeys = [
    'autoApprove',
    'autoExecute',
    'autoAdmission',
    'autoRetry',
    'autoFix',
    'retry',
    'selfHeal',
    'bypassPolicy',
    'bypassApproval',
    'bypassAdmission',
    'maxCycles',
    'overrideLimit'
  ];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return true;
    }
  }
  return false;
}

/**
 * Analyzes untrusted failure evidence and extracts normalized diagnostic data.
 * Zero execution, mutation, approval, admission, or provider authority.
 */
export function analyzeFailureEvidence({
  analysisId,
  parentExecutionResult = null,
  parentVerificationResult = null,
  parentProjectVerificationResult = null,
  context = {}
}) {
  if (hasPrototypePollution(context) ||
      hasPrototypePollution(parentExecutionResult) ||
      hasPrototypePollution(parentVerificationResult) ||
      hasPrototypePollution(parentProjectVerificationResult)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in failure analysis input`);
  }

  if (!analysisId || typeof analysisId !== 'string' || !isValidIdentifier(analysisId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing analysisId identifier`);
  }

  const tenantId = context.tenantId ? String(context.tenantId).trim() : null;
  const workspaceId = context.workspaceId ? String(context.workspaceId).trim() : null;
  const taskId = context.taskId ? String(context.taskId).trim() : null;
  const jobId = context.jobId ? String(context.jobId).trim() : null;

  if (!taskId || !isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing taskId in failure analysis context`);
  }

  // Strict lineage binding across failure evidence inputs
  if (parentExecutionResult) {
    if (parentExecutionResult.taskId && parentExecutionResult.taskId !== taskId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent execution result taskId mismatch: '${parentExecutionResult.taskId}' vs '${taskId}'`);
    }
    if (jobId && parentExecutionResult.jobId && parentExecutionResult.jobId !== jobId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent execution result jobId mismatch: '${parentExecutionResult.jobId}' vs '${jobId}'`);
    }
    if (tenantId && parentExecutionResult.tenantId && parentExecutionResult.tenantId !== tenantId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent execution result tenantId mismatch: '${parentExecutionResult.tenantId}' vs '${tenantId}'`);
    }
    const parentExecWs = parentExecutionResult.workspaceRoot || parentExecutionResult.workspaceId;
    if (workspaceId && parentExecWs && path.resolve(parentExecWs) !== path.resolve(workspaceId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent execution result workspace mismatch: '${parentExecWs}' vs '${workspaceId}'`);
    }
  }

  if (parentVerificationResult) {
    if (parentVerificationResult.taskId && parentVerificationResult.taskId !== taskId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent verification result taskId mismatch: '${parentVerificationResult.taskId}' vs '${taskId}'`);
    }
    if (jobId && parentVerificationResult.jobId && parentVerificationResult.jobId !== jobId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent verification result jobId mismatch: '${parentVerificationResult.jobId}' vs '${jobId}'`);
    }
    if (tenantId && parentVerificationResult.tenantId && parentVerificationResult.tenantId !== tenantId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent verification result tenantId mismatch: '${parentVerificationResult.tenantId}' vs '${tenantId}'`);
    }
    const parentVerWs = parentVerificationResult.workspaceId || parentVerificationResult.workspaceRoot;
    if (workspaceId && parentVerWs && path.resolve(parentVerWs) !== path.resolve(workspaceId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent verification result workspace mismatch: '${parentVerWs}' vs '${workspaceId}'`);
    }
  }

  if (parentProjectVerificationResult) {
    if (parentProjectVerificationResult.taskId && parentProjectVerificationResult.taskId !== taskId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent project verification result taskId mismatch: '${parentProjectVerificationResult.taskId}' vs '${taskId}'`);
    }
    if (jobId && parentProjectVerificationResult.jobId && parentProjectVerificationResult.jobId !== jobId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent project verification result jobId mismatch: '${parentProjectVerificationResult.jobId}' vs '${jobId}'`);
    }
    if (tenantId && parentProjectVerificationResult.tenantId && parentProjectVerificationResult.tenantId !== tenantId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent project verification result tenantId mismatch: '${parentProjectVerificationResult.tenantId}' vs '${tenantId}'`);
    }
    const parentProjWs = parentProjectVerificationResult.workspaceId || parentProjectVerificationResult.workspaceRoot;
    if (workspaceId && parentProjWs && path.resolve(parentProjWs) !== path.resolve(workspaceId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Parent project verification result workspace mismatch: '${parentProjWs}' vs '${workspaceId}'`);
    }
  }

  const failedItems = [];
  let detectedCategory = FailureCategory.UNKNOWN_FAILURE;
  let primaryReason = 'Unknown failure';
  let suggestedTarget = null;
  let suggestedContent = null;

  // 1. Analyze FAZ 55 Project Verification Result if present
  if (parentProjectVerificationResult) {
    if (parentProjectVerificationResult.status === ProjectVerificationStatus.VERIFIED_FAILURE ||
        parentProjectVerificationResult.status === ProjectVerificationStatus.VERIFICATION_DENIED) {
      detectedCategory = FailureCategory.PROJECT_VERIFICATION_FAILURE;
      primaryReason = parentProjectVerificationResult.failureReason || 'Project verification failed';
      
      const checkResults = parentProjectVerificationResult.checkResults || [];
      for (const cr of checkResults) {
        if (cr.result === ValidationResult.FAIL || cr.status === 'FAIL') {
          failedItems.push({
            checkId: cr.id,
            checkType: cr.type,
            target: cr.target || null,
            reason: cr.reason || 'Check failed'
          });
          if (!suggestedTarget && cr.target) {
            suggestedTarget = cr.target;
          }
          if (cr.type === 'FILE_CONTENT' || cr.type === 'EXPECTED_FILE') {
            detectedCategory = cr.type === 'FILE_CONTENT' ? FailureCategory.FILE_CONTENT_MISMATCH : FailureCategory.FILE_MISSING;
          } else if (cr.type === 'TEST_RESULT' || cr.type === 'REGRESSION') {
            detectedCategory = FailureCategory.TEST_FAILURE;
          } else if (cr.type === 'BUILD_RESULT') {
            detectedCategory = FailureCategory.BUILD_FAILURE;
          }
        }
      }
    }
  }

  // 2. Analyze FAZ 54 Execution Verification Result if present
  if (parentVerificationResult && failedItems.length === 0) {
    if (parentVerificationResult.status === UnitVerificationStatus.VERIFIED_FAILURE ||
        parentVerificationResult.status === UnitVerificationStatus.VERIFICATION_DENIED) {
      detectedCategory = FailureCategory.VERIFICATION_FAILURE;
      primaryReason = parentVerificationResult.failureReason || 'Execution verification failed';

      const checks = parentVerificationResult.checks || [];
      for (const chk of checks) {
        if (chk.result === ValidationResult.FAIL) {
          failedItems.push({
            checkId: chk.check,
            checkType: chk.check,
            target: chk.target || null,
            reason: chk.reason || 'Unit verification check failed'
          });
          if (!suggestedTarget && chk.target) {
            suggestedTarget = chk.target;
          }
        }
      }
    }
  }

  // 3. Analyze FAZ 53 Execution Bridge Result if present
  if (parentExecutionResult && failedItems.length === 0) {
    if (parentExecutionResult.status === ExecutionBridgeStatus.FAILED ||
        parentExecutionResult.outcome === 'FAILED' ||
        parentExecutionResult.status === ExecutionBridgeStatus.EXECUTION_DENIED) {
      detectedCategory = FailureCategory.EXECUTION_FAILURE;
      primaryReason = parentExecutionResult.failureReason || 'Execution bridge reported failure';
      if (parentExecutionResult.target) {
        suggestedTarget = parentExecutionResult.target;
      }
      failedItems.push({
        checkId: 'execution-outcome',
        checkType: 'EXECUTION_OUTCOME',
        target: parentExecutionResult.target || null,
        reason: primaryReason
      });
    }
  }

  return Object.freeze({
    analysisId,
    taskId,
    tenantId,
    workspaceId,
    category: detectedCategory,
    primaryReason,
    suggestedTarget,
    suggestedContent,
    failedItems: Object.freeze([...failedItems]),
    failedItemCount: failedItems.length,
    analyzedAt: new Date().toISOString(),
    executionAuthorized: false,
    mutationAuthorized: false,
    approvalAuthorized: false,
    admissionAuthorized: false,
    providerAuthorized: false,
    authorityGuarantee: DefaultProposalAuthorityGuarantee
  });
}

/**
 * Generates an immutable correction proposal bound to failure analysis and lineage.
 */
export function createCorrectionProposal({
  id,
  taskId,
  agentId,
  providerId = 'local-provider',
  tenantId = null,
  workspaceId = null,
  analysis,
  objective,
  operations = [],
  proposedFiles = [],
  correctionCycle = 1,
  parentExecutionId = null,
  parentVerificationId = null,
  metadata = {}
}) {
  if (hasPrototypePollution(metadata) || hasPrototypePollution(analysis)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in correction proposal`);
  }

  if (hasMaliciousAuthorityInjection(metadata)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Authority injection detected in correction proposal metadata`);
  }

  if (typeof correctionCycle !== 'number' || !Number.isInteger(correctionCycle) || correctionCycle < 1) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid correctionCycle '${correctionCycle}'. Must be an integer >= 1`);
  }

  if (correctionCycle > MAX_CORRECTION_CYCLES) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Correction cycle ${correctionCycle} exceeds MAX_CORRECTION_CYCLES (${MAX_CORRECTION_CYCLES})`);
  }

  if (!parentExecutionId && !parentVerificationId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Orphan correction denied: parentExecutionId or parentVerificationId required`);
  }

  if (!analysis || typeof analysis !== 'object') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Missing failure analysis in correction proposal`);
  }

  // Tenant / Workspace match between analysis and proposal
  if (analysis.tenantId && tenantId && analysis.tenantId !== tenantId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Analysis tenant '${analysis.tenantId}' does not match proposal tenant '${tenantId}'`);
  }
  if (analysis.workspaceId && workspaceId && analysis.workspaceId !== workspaceId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Analysis workspace '${analysis.workspaceId}' does not match proposal workspace '${workspaceId}'`);
  }

  // Sanitize and validate operations against failure evidence scope
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op || typeof op !== 'object') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Operation at index ${i} must be an object`);
    }
    const opType = String(op.type || '').trim().toUpperCase();
    if (!Object.values(ProposalOperationType).includes(opType)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unsupported operation type '${op.type}' in correction proposal`);
    }
    if (op.target) {
      const targetCheck = validateProposedFileTarget(op.target);
      if (!targetCheck.valid) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid correction operation target at index ${i}: ${targetCheck.reason}`);
      }
      // Workspace root or broad deletion defense
      if (opType === ProposalOperationType.DELETE) {
        const trimmedTarget = String(op.target).trim();
        if (trimmedTarget === '.' || trimmedTarget === './' || trimmedTarget === '/' || trimmedTarget === '*' || trimmedTarget === '') {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Broad directory deletion in correction proposal is strictly forbidden`);
        }
      }
    }
  }

  const baseProposal = createAgentProposal({
    id,
    taskId,
    agentId,
    providerId,
    tenantId,
    workspaceId,
    objective: objective || `Correction Cycle #${correctionCycle}: ${analysis.primaryReason}`,
    rationale: `Correction proposal based on failure analysis ${analysis.analysisId}`,
    operations,
    proposedFiles,
    metadata: {
      ...metadata,
      correctionCycle,
      parentExecutionId,
      parentVerificationId,
      analysisId: analysis.analysisId
    }
  });

  return Object.freeze({
    ...baseProposal,
    isCorrection: true,
    correctionCycle,
    parentExecutionId,
    parentVerificationId,
    analysisId: analysis.analysisId,
    authorityGuarantee: DefaultProposalAuthorityGuarantee
  });
}

/**
 * Creates an immutable BoundedSelfCorrectionResult contract.
 */
export function createSelfCorrectionResult({
  correctionId,
  taskId,
  jobId,
  tenantId,
  workspaceId,
  correctionCycle,
  status,
  analysis = null,
  proposal = null,
  reviewResult = null,
  approval = null,
  admissionDecision = null,
  executionResult = null,
  verificationResult = null,
  projectVerificationResult = null,
  failureReason = null,
  now = Date.now()
}) {
  if (!correctionId || typeof correctionId !== 'string' || !isValidIdentifier(correctionId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing correctionId identifier`);
  }

  const validStatuses = Object.values(CorrectionStatus);
  if (!status || !validStatuses.includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid correction status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const isTerminal = status === CorrectionStatus.CORRECTION_SUCCEEDED ||
                     status === CorrectionStatus.CORRECTION_LIMIT_REACHED ||
                     status === CorrectionStatus.CORRECTION_DENIED ||
                     (status === CorrectionStatus.CORRECTION_FAILED && correctionCycle >= MAX_CORRECTION_CYCLES);

  return Object.freeze({
    correctionId,
    taskId,
    jobId,
    tenantId,
    workspaceId,
    correctionCycle,
    status,
    maxCycles: MAX_CORRECTION_CYCLES,
    terminal: isTerminal,
    analysis: analysis ? Object.freeze({ ...analysis }) : null,
    proposal: proposal ? Object.freeze({ ...proposal }) : null,
    reviewResult: reviewResult ? Object.freeze({ ...reviewResult }) : null,
    approval: approval ? Object.freeze({ ...approval }) : null,
    admissionDecision: admissionDecision ? Object.freeze({ ...admissionDecision }) : null,
    executionResult: executionResult ? Object.freeze({ ...executionResult }) : null,
    verificationResult: verificationResult ? Object.freeze({ ...verificationResult }) : null,
    projectVerificationResult: projectVerificationResult ? Object.freeze({ ...projectVerificationResult }) : null,
    failureReason,
    timestamp: new Date(now).toISOString(),
    mutationAuthorized: false,
    executionAuthorized: false,
    retryAuthorized: false,
    autoFixAuthorized: false,
    authorityGuarantee: DefaultProposalAuthorityGuarantee
  });
}

/**
 * Evaluates and orchestrates a single bounded self-correction cycle.
 *
 * Enforces:
 * - MAX_CORRECTION_CYCLES = 3 limit.
 * - Single invocation = single cycle evaluation (no unbounded loop).
 * - Full verification chain: execution -> FAZ 54 unit verification -> FAZ 55 project verification.
 * - Strict requirement for new review, new explicit approval, and new admission.
 * - Replay & duplicate execution blocking.
 * - Read-only failure analysis, prompt injection defense, and tenant/workspace containment.
 */
export function orchestrateSelfCorrection({
  correctionId,
  taskId,
  jobId,
  tenantId = null,
  workspaceId = null,
  correctionCycle = 1,
  parentExecutionId = null,
  parentVerificationId = null,
  parentProjectVerificationId = null,
  parentExecutionResult = null,
  parentVerificationResult = null,
  parentProjectVerificationResult = null,
  jobEngine = null,
  agentRegistry = null,
  orchestrationPlan = null,
  correctionProposal = null,
  reviewResult = null,
  approval = null,
  executedAdmissionsTracker = null,
  commandRunner = null,
  expectedVerificationPlan = null,
  rawPayload = {},
  now = Date.now()
}) {
  // Gate 0: Injection Defenses (Prototype Pollution & Malicious Authority Injections)
  if (hasPrototypePollution(rawPayload) ||
      hasPrototypePollution(correctionProposal) ||
      hasPrototypePollution(approval) ||
      hasPrototypePollution(orchestrationPlan)) {
    return createSelfCorrectionResult({
      correctionId: correctionId || 'unknown',
      taskId: taskId || 'unknown',
      jobId: jobId || 'unknown',
      tenantId,
      workspaceId,
      correctionCycle: typeof correctionCycle === 'number' ? correctionCycle : 1,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Prototype pollution detected in correction input'
    });
  }

  if (hasMaliciousAuthorityInjection(rawPayload)) {
    return createSelfCorrectionResult({
      correctionId: correctionId || 'unknown',
      taskId: taskId || 'unknown',
      jobId: jobId || 'unknown',
      tenantId,
      workspaceId,
      correctionCycle: typeof correctionCycle === 'number' ? correctionCycle : 1,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Authority injection detected: parameter overrides (autoApprove, retry, maxCycles) are strictly forbidden'
    });
  }

  // Gate 1: Identifier validations
  if (!correctionId || typeof correctionId !== 'string' || !isValidIdentifier(correctionId)) {
    return createSelfCorrectionResult({
      correctionId: correctionId || 'unknown',
      taskId: taskId || 'unknown',
      jobId: jobId || 'unknown',
      tenantId,
      workspaceId,
      correctionCycle: typeof correctionCycle === 'number' ? correctionCycle : 1,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Invalid or missing correctionId identifier'
    });
  }

  if (!taskId || typeof taskId !== 'string' || !isValidIdentifier(taskId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId: taskId || 'unknown',
      jobId: jobId || 'unknown',
      tenantId,
      workspaceId,
      correctionCycle: typeof correctionCycle === 'number' ? correctionCycle : 1,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Invalid or missing taskId identifier'
    });
  }

  if (!jobId || typeof jobId !== 'string' || !isValidIdentifier(jobId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId: jobId || 'unknown',
      tenantId,
      workspaceId,
      correctionCycle: typeof correctionCycle === 'number' ? correctionCycle : 1,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Invalid or missing jobId identifier'
    });
  }

  // Gate 2: Cycle Validation & Hard Bounded Limit
  if (typeof correctionCycle !== 'number' || !Number.isInteger(correctionCycle) || correctionCycle < 1) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle: 0,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Invalid correctionCycle '${correctionCycle}'. Must be an integer >= 1`
    });
  }

  if (correctionCycle > MAX_CORRECTION_CYCLES) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_LIMIT_REACHED,
      failureReason: `Correction limit reached: cycle ${correctionCycle} exceeds MAX_CORRECTION_CYCLES (${MAX_CORRECTION_CYCLES})`
    });
  }

  // Gate 3: Lineage & Parentage Defenses (No Orphan Corrections)
  if (!parentExecutionId && !parentVerificationId && !parentProjectVerificationId &&
      !parentExecutionResult && !parentVerificationResult && !parentProjectVerificationResult) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: 'Lineage failure: Orphan correction attempt denied. Prior failure evidence required'
    });
  }

  // Lineage validation against provided results
  if (parentExecutionResult && parentExecutionId && parentExecutionResult.executionId !== parentExecutionId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Lineage tampering: parentExecutionId '${parentExecutionId}' does not match executionResult id '${parentExecutionResult.executionId}'`
    });
  }

  if (parentVerificationResult && parentVerificationId && parentVerificationResult.verificationId !== parentVerificationId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Lineage tampering: parentVerificationId '${parentVerificationId}' does not match verificationResult id '${parentVerificationResult.verificationId}'`
    });
  }

  if (parentProjectVerificationResult && parentProjectVerificationId && parentProjectVerificationResult.verificationId !== parentProjectVerificationId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Lineage tampering: parentProjectVerificationId '${parentProjectVerificationId}' does not match projectVerificationResult id '${parentProjectVerificationResult.verificationId}'`
    });
  }

  // Scope matching across parent evidence
  const effectiveTenant = tenantId || (parentExecutionResult ? parentExecutionResult.tenantId : null) || (parentProjectVerificationResult ? parentProjectVerificationResult.tenantId : null);
  if (parentExecutionResult && parentExecutionResult.tenantId && effectiveTenant && parentExecutionResult.tenantId !== effectiveTenant) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Tenant mismatch in parent execution result: '${parentExecutionResult.tenantId}' vs '${effectiveTenant}'`
    });
  }

  if (parentExecutionResult && parentExecutionResult.taskId && parentExecutionResult.taskId !== taskId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Task mismatch in parent execution result: '${parentExecutionResult.taskId}' vs '${taskId}'`
    });
  }

  if (jobId && parentExecutionResult && parentExecutionResult.jobId && parentExecutionResult.jobId !== jobId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Job mismatch in parent execution result: '${parentExecutionResult.jobId}' vs '${jobId}'`
    });
  }

  const parentExecWs = parentExecutionResult ? (parentExecutionResult.workspaceRoot || parentExecutionResult.workspaceId) : null;
  if (workspaceId && parentExecWs && path.resolve(parentExecWs) !== path.resolve(workspaceId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Workspace mismatch in parent execution result: '${parentExecWs}' vs '${workspaceId}'`
    });
  }

  if (parentVerificationResult && parentVerificationResult.taskId && parentVerificationResult.taskId !== taskId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Task mismatch in parent verification result: '${parentVerificationResult.taskId}' vs '${taskId}'`
    });
  }

  if (jobId && parentVerificationResult && parentVerificationResult.jobId && parentVerificationResult.jobId !== jobId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Job mismatch in parent verification result: '${parentVerificationResult.jobId}' vs '${jobId}'`
    });
  }

  if (effectiveTenant && parentVerificationResult && parentVerificationResult.tenantId && parentVerificationResult.tenantId !== effectiveTenant) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Tenant mismatch in parent verification result: '${parentVerificationResult.tenantId}' vs '${effectiveTenant}'`
    });
  }

  const parentVerWs = parentVerificationResult ? (parentVerificationResult.workspaceId || parentVerificationResult.workspaceRoot) : null;
  if (workspaceId && parentVerWs && path.resolve(parentVerWs) !== path.resolve(workspaceId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Workspace mismatch in parent verification result: '${parentVerWs}' vs '${workspaceId}'`
    });
  }

  if (parentProjectVerificationResult && parentProjectVerificationResult.taskId && parentProjectVerificationResult.taskId !== taskId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Task mismatch in parent project verification result: '${parentProjectVerificationResult.taskId}' vs '${taskId}'`
    });
  }

  if (jobId && parentProjectVerificationResult && parentProjectVerificationResult.jobId && parentProjectVerificationResult.jobId !== jobId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Job mismatch in parent project verification result: '${parentProjectVerificationResult.jobId}' vs '${jobId}'`
    });
  }

  if (effectiveTenant && parentProjectVerificationResult && parentProjectVerificationResult.tenantId && parentProjectVerificationResult.tenantId !== effectiveTenant) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Tenant mismatch in parent project verification result: '${parentProjectVerificationResult.tenantId}' vs '${effectiveTenant}'`
    });
  }

  const parentProjWs = parentProjectVerificationResult ? (parentProjectVerificationResult.workspaceId || parentProjectVerificationResult.workspaceRoot) : null;
  if (workspaceId && parentProjWs && path.resolve(parentProjWs) !== path.resolve(workspaceId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Workspace mismatch in parent project verification result: '${parentProjWs}' vs '${workspaceId}'`
    });
  }

  // Workspace isolation check
  if (workspaceId) {
    const checkTarget = validateProposedFileTarget(path.basename(workspaceId));
    if (!checkTarget.valid) {
      return createSelfCorrectionResult({
        correctionId,
        taskId,
        jobId,
        tenantId: effectiveTenant,
        workspaceId,
        correctionCycle,
        status: CorrectionStatus.CORRECTION_DENIED,
        failureReason: `Workspace security failure: ${checkTarget.reason}`
      });
    }
  }

  // Gate 4: Failure Analysis
  let analysis;
  try {
    analysis = analyzeFailureEvidence({
      analysisId: `analysis-${correctionId}`,
      parentExecutionResult,
      parentVerificationResult,
      parentProjectVerificationResult,
      context: {
        tenantId: effectiveTenant,
        workspaceId,
        taskId,
        jobId
      }
    });
  } catch (err) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      failureReason: `Failure analysis error: ${err.message}`
    });
  }

  // Gate 5: Correction Proposal Inspection
  if (!correctionProposal) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      failureReason: 'Missing correction proposal'
    });
  }

  if (correctionProposal.taskId !== taskId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      failureReason: `Task mismatch in correction proposal: '${correctionProposal.taskId}' vs '${taskId}'`
    });
  }

  if (effectiveTenant && correctionProposal.tenantId && correctionProposal.tenantId !== effectiveTenant) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      failureReason: `Tenant mismatch in correction proposal: '${correctionProposal.tenantId}' vs '${effectiveTenant}'`
    });
  }

  if (workspaceId && correctionProposal.workspaceId && path.resolve(correctionProposal.workspaceId) !== path.resolve(workspaceId)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      failureReason: `Workspace mismatch in correction proposal: '${correctionProposal.workspaceId}' vs '${workspaceId}'`
    });
  }

  // Lineage binding in proposal
  if (correctionProposal.correctionCycle && correctionProposal.correctionCycle !== correctionCycle) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      failureReason: `Correction cycle mismatch in proposal: '${correctionProposal.correctionCycle}' vs '${correctionCycle}'`
    });
  }

  // Gate 6: Orchestration Plan & Agent Registry
  if (!orchestrationPlan || typeof orchestrationPlan !== 'object') {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      failureReason: 'Missing or invalid orchestration plan for correction review'
    });
  }

  if (orchestrationPlan.taskId !== taskId) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      failureReason: `Plan task mismatch: Plan taskId '${orchestrationPlan.taskId}' does not match correction taskId '${taskId}'`
    });
  }

  // Gate 7: Proposal Review (Fresh Aggregation & Review Defense)
  const freshReview = aggregateAndReviewProposals({
    taskId,
    orchestrationPlan,
    proposals: [correctionProposal],
    agentRegistry
  });

  if (freshReview.status !== ProposalReviewStatus.REVIEWED || freshReview.conflictCount > 0) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: freshReview,
      failureReason: `Proposal review failed: status '${freshReview.status}', conflicts: ${freshReview.conflictCount}`
    });
  }

  // Defend against stale or injected review reuse across cycles, proposals, or plans
  if (reviewResult) {
    if (reviewResult.taskId && reviewResult.taskId !== taskId) {
      return createSelfCorrectionResult({
        correctionId,
        taskId,
        jobId,
        tenantId: effectiveTenant,
        workspaceId,
        correctionCycle,
        status: CorrectionStatus.CORRECTION_DENIED,
        analysis,
        proposal: correctionProposal,
        failureReason: 'Review reuse denied: Supplied review does not match current correction proposal or plan'
      });
    }

    const currentProposalFingerprint = computeProposalSetFingerprint([correctionProposal]);
    const suppliedFingerprint = reviewResult.proposalSetFingerprint ||
      (Array.isArray(reviewResult.proposals) ? computeProposalSetFingerprint(reviewResult.proposals) : null);

    if (!suppliedFingerprint || suppliedFingerprint !== currentProposalFingerprint) {
      return createSelfCorrectionResult({
        correctionId,
        taskId,
        jobId,
        tenantId: effectiveTenant,
        workspaceId,
        correctionCycle,
        status: CorrectionStatus.CORRECTION_DENIED,
        analysis,
        proposal: correctionProposal,
        failureReason: 'Review reuse denied: Supplied review does not match current correction proposal or plan'
      });
    }

    if (reviewResult.planId && orchestrationPlan.id && reviewResult.planId !== orchestrationPlan.id) {
      return createSelfCorrectionResult({
        correctionId,
        taskId,
        jobId,
        tenantId: effectiveTenant,
        workspaceId,
        correctionCycle,
        status: CorrectionStatus.CORRECTION_DENIED,
        analysis,
        proposal: correctionProposal,
        failureReason: 'Review reuse denied: Supplied review does not match current correction proposal or plan'
      });
    }
  }

  let effectiveReviewResult = freshReview;
  if (approval && approval.reviewId) {
    effectiveReviewResult = Object.freeze({
      ...freshReview,
      id: approval.reviewId
    });
  }

  // Gate 8: Explicit Approval Gate (NO AUTO-APPROVAL)
  if (!approval) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_PENDING_APPROVAL,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      failureReason: 'Explicit approval is required before correction admission and execution'
    });
  }

  // Gate 9: Approval Record Validation (Check freshness, drift, non-reuse)
  const approvalValidation = validateApprovalRecord(approval, {
    expectedTaskId: taskId,
    expectedPlanId: orchestrationPlan.id,
    expectedTenantId: effectiveTenant,
    expectedWorkspaceId: workspaceId,
    reviewResult: effectiveReviewResult,
    currentProposals: [correctionProposal],
    now
  });

  if (!approvalValidation.valid) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      failureReason: `Approval re-validation failed: ${approvalValidation.reason}`
    });
  }

  // Gate 10: Controlled Admission Gate (NO AUTO-ADMISSION)
  const admissionDecision = evaluateApprovalAdmission({
    tenantId: effectiveTenant,
    workspaceId,
    taskId,
    orchestrationPlan,
    reviewResult: effectiveReviewResult,
    approval,
    proposals: [correctionProposal],
    now
  });

  if (admissionDecision.admissionStatus !== AdmissionStatus.ADMISSION_ALLOWED || !admissionDecision.admitted) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      failureReason: `Admission denied: ${admissionDecision.reason || 'Admission decision was not ALLOWED'}`
    });
  }

  // Replay protection on admission / approval
  const admissionKey = admissionDecision.approvalId || admissionDecision.taskId || correctionId;
  if (executedAdmissionsTracker && executedAdmissionsTracker.has(admissionKey)) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      failureReason: `Replay execution blocked: Admission/Approval '${admissionKey}' has already been executed`
    });
  }

  // Gate 11: Controlled Execution via FAZ 53 Execution Bridge
  if (!jobEngine) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      failureReason: 'Missing jobEngine required for controlled execution bridge'
    });
  }

  const executionId = `exec-corr-${correctionCycle}-${correctionId}`;
  const executionBridgeResult = executeAdmittedBridge({
    executionId,
    jobEngine,
    admissionDecision,
    approval,
    reviewResult: effectiveReviewResult,
    orchestrationPlan,
    proposals: [correctionProposal],
    workspaceRoot: workspaceId || process.cwd(),
    tenantId: effectiveTenant,
    commandRunner,
    executedAdmissionsTracker,
    now
  });

  const executionSucceeded = executionBridgeResult.status === ExecutionBridgeStatus.EXECUTED &&
                            executionBridgeResult.outcome === 'SUCCEEDED';

  // Gate 12: FAZ 54 Execution Verification
  const expectedFingerprint = computeProposalSetFingerprint([correctionProposal]);
  const expectedTarget = correctionProposal.operations && correctionProposal.operations[0] ? correctionProposal.operations[0].target : null;
  const expectedContent = correctionProposal.operations && correctionProposal.operations[0] ? (correctionProposal.operations[0].content || correctionProposal.operations[0].description) : null;

  const unitVerification = verifyExecutionResult({
    verificationId: `ver-corr-${correctionCycle}-${correctionId}`,
    executionResult: executionBridgeResult,
    expectedState: {
      targetExists: expectedTarget ? true : undefined,
      expectedContent: expectedContent || undefined
    },
    expectedProposalFingerprint: expectedFingerprint,
    context: {
      executionId,
      jobId: executionBridgeResult.jobId || jobId,
      workUnitId: executionBridgeResult.workUnitId,
      taskId,
      planId: executionBridgeResult.planId,
      tenantId: effectiveTenant,
      workspaceId
    },
    now
  });

  // Post-Execution Lineage Verification (FAZ 54 unit verification)
  const unitLineageValid = Boolean(
    unitVerification &&
    unitVerification.executionId === executionBridgeResult.executionId &&
    unitVerification.taskId === taskId &&
    (!jobId || unitVerification.jobId === (executionBridgeResult.jobId || jobId)) &&
    (!effectiveTenant || !unitVerification.tenantId || unitVerification.tenantId === effectiveTenant) &&
    (!workspaceId || !unitVerification.workspaceId || path.resolve(unitVerification.workspaceId) === path.resolve(workspaceId))
  );

  const unitVerificationSucceeded = Boolean(
    unitVerification &&
    unitVerification.status === UnitVerificationStatus.VERIFIED_SUCCESS &&
    unitLineageValid
  );

  // Gate 13: FAZ 55 Project Verification (Mandatory for Success)
  if (!executionSucceeded) {
    const failureDetails = `Execution failed: ${executionBridgeResult.failureReason || executionBridgeResult.status}`;
    if (correctionCycle >= MAX_CORRECTION_CYCLES) {
      return createSelfCorrectionResult({
        correctionId,
        taskId,
        jobId,
        tenantId: effectiveTenant,
        workspaceId,
        correctionCycle,
        status: CorrectionStatus.CORRECTION_LIMIT_REACHED,
        analysis,
        proposal: correctionProposal,
        reviewResult: effectiveReviewResult,
        approval,
        admissionDecision,
        executionResult: executionBridgeResult,
        verificationResult: unitVerification,
        projectVerificationResult: null,
        failureReason: `Correction limit reached (${MAX_CORRECTION_CYCLES} cycles exhausted). Final failure: ${failureDetails}`,
        now
      });
    }

    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_FAILED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      executionResult: executionBridgeResult,
      verificationResult: unitVerification,
      projectVerificationResult: null,
      failureReason: failureDetails,
      now
    });
  }

  if (!expectedVerificationPlan) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_DENIED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      executionResult: executionBridgeResult,
      verificationResult: unitVerification,
      projectVerificationResult: null,
      failureReason: 'Missing mandatory project verification plan (FAZ 55): Project-level verification is strictly required for self-correction success',
      now
    });
  }

  const projectVerification = orchestrateProjectVerification({
    verificationId: `proj-ver-corr-${correctionCycle}-${correctionId}`,
    verificationPlan: expectedVerificationPlan,
    executionResults: [executionBridgeResult],
    expectedProposalFingerprint: expectedFingerprint,
    proposals: [correctionProposal],
    context: {
      tenantId: effectiveTenant,
      workspaceId,
      taskId,
      jobId: expectedVerificationPlan.jobId || executionBridgeResult.jobId || jobId
    },
    now
  });

  // Post-Execution Lineage Verification (FAZ 55 project verification)
  const projectLineageValid = Boolean(
    projectVerification &&
    projectVerification.taskId === taskId &&
    (!jobId || projectVerification.jobId === (expectedVerificationPlan.jobId || executionBridgeResult.jobId || jobId)) &&
    (!effectiveTenant || !projectVerification.tenantId || projectVerification.tenantId === effectiveTenant) &&
    (!workspaceId || !projectVerification.workspaceId || path.resolve(projectVerification.workspaceId) === path.resolve(workspaceId))
  );

  const projectVerificationSucceeded = Boolean(
    projectVerification &&
    projectVerification.status === ProjectVerificationStatus.VERIFIED_SUCCESS &&
    projectLineageValid
  );

  // Gate 14: Explicit Success Condition (NO FALSE SUCCESS)
  if (executionSucceeded && unitVerificationSucceeded && projectVerificationSucceeded) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_SUCCEEDED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      executionResult: executionBridgeResult,
      verificationResult: unitVerification,
      projectVerificationResult: projectVerification,
      now
    });
  }

  // Gate 15: Failure Condition & Hard Cycle Limit
  const failureDetails = !executionSucceeded
    ? `Execution failed: ${executionBridgeResult.failureReason || executionBridgeResult.status}`
    : (!unitVerificationSucceeded
        ? `Unit verification failed: ${unitVerification ? (unitVerification.failureReason || unitVerification.status) : 'Invalid unit verification lineage'}`
        : `Project verification failed: ${projectVerification ? (projectVerification.failureReason || projectVerification.status) : 'Invalid project verification lineage'}`);

  if (correctionCycle >= MAX_CORRECTION_CYCLES) {
    return createSelfCorrectionResult({
      correctionId,
      taskId,
      jobId,
      tenantId: effectiveTenant,
      workspaceId,
      correctionCycle,
      status: CorrectionStatus.CORRECTION_LIMIT_REACHED,
      analysis,
      proposal: correctionProposal,
      reviewResult: effectiveReviewResult,
      approval,
      admissionDecision,
      executionResult: executionBridgeResult,
      verificationResult: unitVerification,
      projectVerificationResult: projectVerification,
      failureReason: `Correction limit reached (${MAX_CORRECTION_CYCLES} cycles exhausted). Final failure: ${failureDetails}`,
      now
    });
  }

  return createSelfCorrectionResult({
    correctionId,
    taskId,
    jobId,
    tenantId: effectiveTenant,
    workspaceId,
    correctionCycle,
    status: CorrectionStatus.CORRECTION_FAILED,
    analysis,
    proposal: correctionProposal,
    reviewResult: effectiveReviewResult,
    approval,
    admissionDecision,
    executionResult: executionBridgeResult,
    verificationResult: unitVerification,
    projectVerificationResult: projectVerification,
    failureReason: failureDetails,
    now
  });
}
