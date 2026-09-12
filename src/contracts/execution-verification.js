/**
 * AI Development OS - Execution Result Verification Contract
 * Phase 54 Foundation - Deterministic Verification of Controlled Execution Results
 *
 * CORE INVARIANTS:
 * 1. ONE EXECUTION RESULT -> ONE DETERMINISTIC VERIFICATION -> STOP:
 *    Zero retries, zero auto-fix, zero self-healing, zero recursive loops.
 * 2. VERIFICATION != EXECUTION:
 *    Verification is strictly read-only.
 *    No execution authority (executionAuthorized: false).
 *    No mutation authority (mutationAuthorized: false).
 *    Cannot spawn processes, cannot write/delete files, cannot invoke AI/agents.
 * 3. FAIL-CLOSED IDENTITY & SCOPE BINDINGS:
 *    Execution ID, Job ID, WorkUnit ID, Task ID, Tenant ID, and Workspace ID
 *    must strictly match between execution result and verification context.
 *    Any mismatch -> VERIFICATION_DENIED.
 * 4. STRICT DISTINCTION BETWEEN DENIED vs FAILURE vs SUCCESS:
 *    - VERIFICATION_DENIED: Pre-verification validation failure (scope/identity mismatch, malformed input, prototype pollution).
 *    - VERIFIED_SUCCESS: Execution succeeded AND all expected state invariants are fully satisfied.
 *    - VERIFIED_FAILURE: Execution failed OR expected state invariant is not satisfied (NO FALSE SUCCESS).
 * 5. RESULT INJECTION & PROMPT INJECTION DEFENSE:
 *    Claims within execution result (e.g. stdout saying "APPROVE" or metadata claiming "executionAuthorized: true")
 *    are untrusted data only and confer zero authority.
 * 6. PURE DETERMINISM & DEEP IMMUTABILITY:
 *    Same inputs produce identical verification results.
 *    All outputs, check arrays, and nested structures are deeply frozen (Object.freeze).
 * 7. ZERO BACKGROUND TIMERS / WORKERS:
 *    No setTimeout, setInterval, setImmediate, queues, or background tasks.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ErrorCodes,
  ValidationResult
} from './constants.js';
import { DefaultProposalAuthorityGuarantee, validateProposedFileTarget } from './agent-proposal.js';
import { computeProposalSetFingerprint } from './approval-admission.js';
import { isPathInsideDirectory } from '../interfaces/core.js';

export const VerificationStatus = Object.freeze({
  VERIFIED_SUCCESS: 'VERIFIED_SUCCESS',
  VERIFIED_FAILURE: 'VERIFIED_FAILURE',
  VERIFICATION_DENIED: 'VERIFICATION_DENIED'
});

export const VerificationCheckName = Object.freeze({
  EXECUTION_OUTCOME: 'EXECUTION_OUTCOME',
  TARGET_EXISTENCE: 'TARGET_EXISTENCE',
  CONTENT_INTEGRITY: 'CONTENT_INTEGRITY',
  UNEXPECTED_MUTATION: 'UNEXPECTED_MUTATION',
  EXIT_CODE: 'EXIT_CODE',
  PROPOSAL_FINGERPRINT: 'PROPOSAL_FINGERPRINT'
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
 * Creates an immutable, declarative ExecutionVerificationResult contract.
 */
export function createExecutionVerificationResult({
  verificationId,
  executionId,
  jobId,
  workUnitId,
  taskId,
  planId = null,
  tenantId,
  workspaceId,
  status,
  checks = [],
  passedChecks = [],
  failedChecks = [],
  expected = {},
  observed = {},
  failureReason = null,
  verifiedAt = new Date().toISOString()
}) {
  if (!verificationId || typeof verificationId !== 'string') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] verificationId must be a non-empty string`);
  }
  if (!Object.values(VerificationStatus).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid VerificationStatus: ${status}`);
  }

  return Object.freeze({
    verificationId,
    executionId,
    jobId,
    workUnitId,
    taskId,
    planId,
    tenantId,
    workspaceId,
    status,
    checks: Object.freeze(checks.map(c => Object.freeze({ ...c }))),
    passedChecks: Object.freeze([...passedChecks]),
    failedChecks: Object.freeze([...failedChecks]),
    expected: Object.freeze({ ...expected }),
    observed: Object.freeze({ ...observed }),
    failureReason,
    verifiedAt,
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    metadata: Object.freeze({
      deterministic: true,
      singleVerification: true,
      readOnly: true,
      terminal: true
    })
  });
}

/**
 * Deterministically verifies an execution result against expected invariants and observed workspace state.
 *
 * Enforces:
 * - Fail-closed gate validation (identity, tenant, workspace, plan, proposal fingerprints).
 * - Read-only inspection of target file system state (CREATE, MODIFY, DELETE, TEST).
 * - Distinction between VERIFICATION_DENIED (preflight mismatch/attack) and VERIFIED_FAILURE (invariant failure).
 * - No false successes: execution SUCCEEDED alone is insufficient if observed state violates expected state.
 */
export function verifyExecutionResult({
  verificationId,
  executionResult,
  expectedState: rawExpectedState = {},
  expectedProposalFingerprint = null,
  jobEngine = null,
  context: rawContext = {},
  now = Date.now()
}) {
  const expectedState = (rawExpectedState && typeof rawExpectedState === 'object') ? rawExpectedState : {};
  const context = (rawContext && typeof rawContext === 'object') ? rawContext : {};

  // Gate 0: Prototype Pollution & Basic Type Defenses
  if (hasPrototypePollution(executionResult) || hasPrototypePollution(rawExpectedState) || hasPrototypePollution(rawContext)) {
    return Object.freeze({
      verificationId: verificationId || 'unknown',
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Prototype pollution detected in verification input',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 1: Verification ID & Execution Result Object Validation
  if (!verificationId || typeof verificationId !== 'string' || !isValidIdentifier(verificationId)) {
    return Object.freeze({
      verificationId: verificationId || 'unknown',
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid verificationId string identifier',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (!executionResult || typeof executionResult !== 'object' || Array.isArray(executionResult)) {
    return Object.freeze({
      verificationId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or malformed executionResult object',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 2: Execution ID matching
  const resExecId = executionResult.executionId || executionResult.id;
  if (!resExecId || typeof resExecId !== 'string' || !isValidIdentifier(resExecId)) {
    return Object.freeze({
      verificationId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid executionId in executionResult',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.executionId && context.executionId !== resExecId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Execution ID mismatch: Expected '${context.executionId}', got '${resExecId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 3: Job ID matching
  const resJobId = executionResult.jobId;
  if (!resJobId || typeof resJobId !== 'string' || !isValidIdentifier(resJobId)) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid jobId in executionResult',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.jobId && context.jobId !== resJobId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Job ID mismatch: Expected '${context.jobId}', got '${resJobId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 4: WorkUnit ID matching
  const resWorkUnitId = executionResult.workUnitId;
  if (!resWorkUnitId || typeof resWorkUnitId !== 'string' || !isValidIdentifier(resWorkUnitId)) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid workUnitId in executionResult',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.workUnitId && context.workUnitId !== resWorkUnitId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `WorkUnit ID mismatch: Expected '${context.workUnitId}', got '${resWorkUnitId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 5: Task ID matching
  const resTaskId = executionResult.taskId;
  if (!resTaskId || typeof resTaskId !== 'string' || !isValidIdentifier(resTaskId)) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid taskId in executionResult',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.taskId && context.taskId !== resTaskId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      taskId: resTaskId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Task ID mismatch: Expected '${context.taskId}', got '${resTaskId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 6: Plan ID matching (if present)
  const resPlanId = executionResult.planId || null;
  if (context.planId && resPlanId && context.planId !== resPlanId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      taskId: resTaskId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Plan ID mismatch: Expected '${context.planId}', got '${resPlanId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 7: Tenant Isolation check (Strict match, no fallback, no default)
  const resTenantId = executionResult.tenantId || null;
  if (!resTenantId || typeof resTenantId !== 'string' || resTenantId.trim() === '') {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      taskId: resTaskId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or empty tenantId in executionResult. Tenant fallback forbidden',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.tenantId && context.tenantId !== resTenantId) {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      taskId: resTaskId,
      tenantId: resTenantId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Tenant mismatch: Expected '${context.tenantId}', got '${resTenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 8: Workspace Isolation & Path Traversal check
  const resWorkspace = executionResult.workspaceRoot || executionResult.workspaceId || null;
  if (!resWorkspace || typeof resWorkspace !== 'string' || resWorkspace.trim() === '') {
    return Object.freeze({
      verificationId,
      executionId: resExecId,
      jobId: resJobId,
      workUnitId: resWorkUnitId,
      taskId: resTaskId,
      tenantId: resTenantId,
      status: VerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or empty workspaceRoot in executionResult',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  const resolvedWorkspace = path.resolve(resWorkspace);
  if (context.workspaceId) {
    const resolvedExpectedWorkspace = path.resolve(context.workspaceId);
    if (resolvedWorkspace !== resolvedExpectedWorkspace) {
      return Object.freeze({
        verificationId,
        executionId: resExecId,
        jobId: resJobId,
        workUnitId: resWorkUnitId,
        taskId: resTaskId,
        tenantId: resTenantId,
        workspaceId: resolvedWorkspace,
        status: VerificationStatus.VERIFICATION_DENIED,
        outcome: 'DENIED',
        failureReason: `Workspace mismatch: Expected '${resolvedExpectedWorkspace}', got '${resolvedWorkspace}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // Gate 9: Proposal Fingerprint validation (Proposal drift defense)
  if (expectedProposalFingerprint) {
    const currentProposals = expectedState.proposals || context.proposals || null;
    if (currentProposals) {
      const actualFingerprint = computeProposalSetFingerprint(currentProposals);
      if (actualFingerprint !== expectedProposalFingerprint) {
        return Object.freeze({
          verificationId,
          executionId: resExecId,
          jobId: resJobId,
          workUnitId: resWorkUnitId,
          taskId: resTaskId,
          tenantId: resTenantId,
          workspaceId: resolvedWorkspace,
          status: VerificationStatus.VERIFICATION_DENIED,
          outcome: 'DENIED',
          failureReason: 'Proposal fingerprint mismatch: Proposals drifted from approved fingerprint',
          code: ErrorCodes.SECURITY_BLOCKED,
          authorityGuarantee: DefaultProposalAuthorityGuarantee
        });
      }
    }
  }

  // Gate 10: Target validation (traversal, absolute path, UNC path, null byte, injection defense)
  const target = expectedState.target || executionResult.target || null;
  if (target) {
    const targetCheck = validateProposedFileTarget(target);
    if (!targetCheck.valid) {
      return Object.freeze({
        verificationId,
        executionId: resExecId,
        jobId: resJobId,
        workUnitId: resWorkUnitId,
        taskId: resTaskId,
        tenantId: resTenantId,
        workspaceId: resolvedWorkspace,
        status: VerificationStatus.VERIFICATION_DENIED,
        outcome: 'DENIED',
        failureReason: `Invalid verification target: ${targetCheck.reason}`,
        code: ErrorCodes.SECURITY_BLOCKED,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }

    const resolvedTarget = path.resolve(resolvedWorkspace, target);
    if (!isPathInsideDirectory(resolvedTarget, resolvedWorkspace)) {
      return Object.freeze({
        verificationId,
        executionId: resExecId,
        jobId: resJobId,
        workUnitId: resWorkUnitId,
        taskId: resTaskId,
        tenantId: resTenantId,
        workspaceId: resolvedWorkspace,
        status: VerificationStatus.VERIFICATION_DENIED,
        outcome: 'DENIED',
        failureReason: `Target path '${target}' escapes workspace root '${resolvedWorkspace}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // --- BEGIN DETERMINISTIC INVARIANT VERIFICATION CHECKS ---
  const checks = [];
  const passedChecks = [];
  const failedChecks = [];
  const observed = {};
  const expected = { ...expectedState };
  let verificationFailed = false;
  let primaryFailureReason = null;

  function recordCheck(name, passed, reason = null) {
    const checkRecord = {
      name,
      status: passed ? ValidationResult.PASS : ValidationResult.FAIL,
      reason
    };
    checks.push(checkRecord);
    if (passed) {
      passedChecks.push(name);
    } else {
      failedChecks.push(name);
      verificationFailed = true;
      if (!primaryFailureReason) {
        primaryFailureReason = reason || `Check failed: ${name}`;
      }
    }
  }

  // Check 1: Execution Process Outcome Check
  const execOutcome = executionResult.outcome || (executionResult.status === 'EXECUTED' ? 'SUCCEEDED' : 'FAILED');
  observed.executionOutcome = execOutcome;
  const expectedOutcome = expectedState.outcome || 'SUCCEEDED';
  if (execOutcome === expectedOutcome && executionResult.status !== 'FAILED') {
    recordCheck(VerificationCheckName.EXECUTION_OUTCOME, true);
  } else {
    recordCheck(
      VerificationCheckName.EXECUTION_OUTCOME,
      false,
      `Execution outcome '${execOutcome}' does not match expected '${expectedOutcome}' (status: ${executionResult.status})`
    );
  }

  // Check 2: Exit code check (if present in execution details or metadata)
  const metadataExitCode = executionResult.metadata?.exitCode ?? executionResult.exitCode ?? null;
  if (metadataExitCode !== null) {
    observed.exitCode = metadataExitCode;
    const expectedExitCode = expectedState.exitCode !== undefined ? expectedState.exitCode : 0;
    if (metadataExitCode === expectedExitCode) {
      recordCheck(VerificationCheckName.EXIT_CODE, true);
    } else {
      recordCheck(
        VerificationCheckName.EXIT_CODE,
        false,
        `Exit code '${metadataExitCode}' does not match expected '${expectedExitCode}'`
      );
    }
  }

  // Check 3: Deterministic Workspace State / File Mutation Inspection
  const operation = (expectedState.operation || executionResult.operation || '').trim().toUpperCase();
  if (target) {
    const resolvedTarget = path.resolve(resolvedWorkspace, target);
    let targetExists = false;
    let targetContent = null;

    try {
      if (fs.existsSync(resolvedTarget)) {
        targetExists = true;
        // Read file safely
        targetContent = fs.readFileSync(resolvedTarget, 'utf-8');
      }
    } catch (err) {
      targetExists = false;
      targetContent = null;
    }

    observed.target = target;
    observed.targetExists = targetExists;
    observed.targetContent = targetContent;

    if (operation === 'CREATE') {
      if (targetExists) {
        recordCheck(VerificationCheckName.TARGET_EXISTENCE, true);
        if (expectedState.expectedContent !== undefined && expectedState.expectedContent !== null) {
          if (targetContent === expectedState.expectedContent) {
            recordCheck(VerificationCheckName.CONTENT_INTEGRITY, true);
          } else {
            recordCheck(
              VerificationCheckName.CONTENT_INTEGRITY,
              false,
              `Created file content does not match expectedContent`
            );
          }
        }
      } else {
        recordCheck(
          VerificationCheckName.TARGET_EXISTENCE,
          false,
          `Expected created file '${target}' does not exist on filesystem`
        );
      }
    } else if (operation === 'MODIFY') {
      if (targetExists) {
        recordCheck(VerificationCheckName.TARGET_EXISTENCE, true);
        if (expectedState.expectedContent !== undefined && expectedState.expectedContent !== null) {
          if (targetContent === expectedState.expectedContent) {
            recordCheck(VerificationCheckName.CONTENT_INTEGRITY, true);
          } else {
            recordCheck(
              VerificationCheckName.CONTENT_INTEGRITY,
              false,
              `Modified file content does not match expectedContent`
            );
          }
        }
      } else {
        recordCheck(
          VerificationCheckName.TARGET_EXISTENCE,
          false,
          `Target file '${target}' for MODIFY operation is missing`
        );
      }
    } else if (operation === 'DELETE') {
      if (!targetExists) {
        recordCheck(VerificationCheckName.TARGET_EXISTENCE, true);
      } else {
        recordCheck(
          VerificationCheckName.TARGET_EXISTENCE,
          false,
          `Target file '${target}' expected to be DELETED still exists on filesystem`
        );
      }
    } else if (operation === 'READ' || operation === 'ANALYZE' || operation === 'TEST') {
      // Read/Test operations: target should exist if specified as a file to read/test
      if (expectedState.shouldExist !== undefined) {
        if (targetExists === expectedState.shouldExist) {
          recordCheck(VerificationCheckName.TARGET_EXISTENCE, true);
        } else {
          recordCheck(
            VerificationCheckName.TARGET_EXISTENCE,
            false,
            `Target file existence (${targetExists}) does not match expected (${expectedState.shouldExist})`
          );
        }
      }
    }
  }

  // Check 4: Unexpected file modifications check (if plan expectedFileChanges is specified)
  if (expectedState.expectedFileChanges && Array.isArray(expectedState.expectedFileChanges)) {
    const expectedFiles = expectedState.expectedFileChanges.map(f => path.resolve(resolvedWorkspace, f));
    if (observed.target) {
      const resolvedTarget = path.resolve(resolvedWorkspace, observed.target);
      if (!expectedFiles.includes(resolvedTarget)) {
        recordCheck(
          VerificationCheckName.UNEXPECTED_MUTATION,
          false,
          `Unexpected file mutation on target '${observed.target}' not listed in expectedFileChanges`
        );
      } else {
        recordCheck(VerificationCheckName.UNEXPECTED_MUTATION, true);
      }
    }
  }

  const finalStatus = verificationFailed
    ? VerificationStatus.VERIFIED_FAILURE
    : VerificationStatus.VERIFIED_SUCCESS;

  const verifiedAt = typeof now === 'number' ? new Date(now).toISOString() : new Date().toISOString();

  return createExecutionVerificationResult({
    verificationId,
    executionId: resExecId,
    jobId: resJobId,
    workUnitId: resWorkUnitId,
    taskId: resTaskId,
    planId: resPlanId,
    tenantId: resTenantId,
    workspaceId: resolvedWorkspace,
    status: finalStatus,
    checks,
    passedChecks,
    failedChecks,
    expected,
    observed,
    failureReason: primaryFailureReason,
    verifiedAt
  });
}
