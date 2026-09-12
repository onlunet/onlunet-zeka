/**
 * AI Development OS - Project / Test Verification Orchestration Contract
 * Phase 55 Foundation - Deterministic Multi-Check Verification Orchestration
 *
 * CORE INVARIANTS:
 * 1. ONE EXPLICIT VERIFICATION ORCHESTRATION -> STOP:
 *    Zero retries, zero auto-fix, zero self-healing, zero recursive loops, zero background queues.
 * 2. VERIFICATION != EXECUTION:
 *    Verification is strictly read-only inspection & deterministic evaluation.
 *    No execution authority (executionAuthorized: false, shellAuthorized: false).
 *    No mutation authority (mutationAuthorized: false).
 * 3. EXPLICIT CHECKS ONLY:
 *    Only checks explicitly listed in verificationPlan are executed. No secret/implicit checks.
 * 4. DETERMINISTIC AGGREGATION:
 *    Checks execute in deterministic order.
 *    All required checks must PASS for VERIFIED_SUCCESS.
 *    Any required check FAIL -> VERIFIED_FAILURE (NO FALSE SUCCESS).
 *    Pre-verification mismatches/attacks -> VERIFICATION_DENIED.
 * 5. MULTI-LAYER BINDINGS:
 *    Verification Plan, Execution Results, Task, Job, Tenant, and Workspace must match strictly.
 *    Cross-tenant access or workspace traversal is strictly blocked fail-closed.
 * 6. DEEP IMMUTABILITY:
 *    Verification Plan, individual Check Results, and Aggregated Result are deeply frozen.
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
import {
  verifyExecutionResult,
  VerificationStatus as ExecutionVerificationStatus,
  VerificationCheckName as UnitCheckName
} from './execution-verification.js';

export const ProjectVerificationStatus = Object.freeze({
  VERIFIED_SUCCESS: 'VERIFIED_SUCCESS',
  VERIFIED_FAILURE: 'VERIFIED_FAILURE',
  VERIFICATION_DENIED: 'VERIFICATION_DENIED'
});

export const ProjectCheckType = Object.freeze({
  EXECUTION_RESULT: 'EXECUTION_RESULT',
  FILE_STATE: 'FILE_STATE',
  FILE_CONTENT: 'FILE_CONTENT',
  EXPECTED_FILE: 'EXPECTED_FILE',
  UNEXPECTED_FILE: 'UNEXPECTED_FILE',
  TEST_RESULT: 'TEST_RESULT',
  BUILD_RESULT: 'BUILD_RESULT',
  ARTIFACT_EXISTS: 'ARTIFACT_EXISTS',
  ARTIFACT_CONTENT: 'ARTIFACT_CONTENT',
  PROJECT_CONTRACT: 'PROJECT_CONTRACT',
  REGRESSION: 'REGRESSION'
});

export const CheckSeverity = Object.freeze({
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL'
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
 * Creates an immutable ProjectVerificationPlan contract.
 */
export function createProjectVerificationPlan(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Plan must be a non-null object`);
  }
  if (hasPrototypePollution(rawInput) ||
      hasPrototypePollution(rawInput.metadata) ||
      hasPrototypePollution(rawInput.checks)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in verification plan`);
  }

  const {
    id,
    taskId,
    jobId,
    tenantId,
    workspaceId,
    executionIds = [],
    checks = [],
    metadata = {}
  } = rawInput;

  if (!id || typeof id !== 'string' || !isValidIdentifier(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing verification plan id`);
  }
  if (!taskId || typeof taskId !== 'string' || !isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing taskId`);
  }
  if (!jobId || typeof jobId !== 'string' || !isValidIdentifier(jobId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing jobId`);
  }
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing tenantId`);
  }
  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing workspaceId`);
  }
  if (!Array.isArray(checks)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] checks must be an array`);
  }

  const normalizedChecks = checks.map((c, idx) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Check at index ${idx} must be an object`);
    }
    if (hasPrototypePollution(c)) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution in check at index ${idx}`);
    }
    const checkType = String(c.type || '').trim().toUpperCase();
    if (!Object.values(ProjectCheckType).includes(checkType)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unsupported check type '${c.type}' at index ${idx}`);
    }
    const severity = c.severity && String(c.severity).trim().toUpperCase() === CheckSeverity.OPTIONAL
      ? CheckSeverity.OPTIONAL
      : CheckSeverity.REQUIRED;

    return Object.freeze({
      id: c.id ? String(c.id).trim() : `chk-${idx}-${checkType}`,
      type: checkType,
      target: c.target ? String(c.target).trim() : null,
      expected: c.expected ? Object.freeze({ ...c.expected }) : null,
      severity,
      description: c.description ? String(c.description).trim() : '',
      executionId: c.executionId ? String(c.executionId).trim() : null
    });
  });

  return Object.freeze({
    id: id.trim(),
    taskId: taskId.trim(),
    jobId: jobId.trim(),
    tenantId: tenantId.trim(),
    workspaceId: path.resolve(workspaceId.trim()),
    executionIds: Object.freeze([...executionIds].map(x => String(x).trim())),
    checks: Object.freeze(normalizedChecks),
    metadata: Object.freeze({ ...metadata }),
    createdAt: new Date().toISOString()
  });
}

/**
 * Creates an immutable ProjectVerificationResult contract.
 */
export function createProjectVerificationResult({
  verificationId,
  planId,
  taskId,
  jobId,
  tenantId,
  workspaceId,
  status,
  totalChecks = 0,
  passedCount = 0,
  failedCount = 0,
  checkResults = [],
  passedChecks = [],
  failedChecks = [],
  failureReason = null,
  verifiedAt = new Date().toISOString()
}) {
  if (!verificationId || typeof verificationId !== 'string') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] verificationId must be a non-empty string`);
  }
  if (!Object.values(ProjectVerificationStatus).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid ProjectVerificationStatus: ${status}`);
  }

  return Object.freeze({
    verificationId,
    planId,
    taskId,
    jobId,
    tenantId,
    workspaceId,
    status,
    totalChecks,
    passedCount,
    failedCount,
    checkResults: Object.freeze(checkResults.map(r => Object.freeze({ ...r }))),
    passedChecks: Object.freeze([...passedChecks]),
    failedChecks: Object.freeze([...failedChecks]),
    failureReason,
    verifiedAt,
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    metadata: Object.freeze({
      deterministic: true,
      singleOrchestration: true,
      readOnly: true,
      terminal: true
    })
  });
}

/**
 * Deterministically orchestrates project-level verification checks against execution results and workspace state.
 *
 * Enforces:
 * - Fail-closed gate validation (Plan validity, Tenant matching, Workspace containment, Task/Job bindings).
 * - Execution results binding: each check references authentic admitted execution results.
 * - Explicit check dispatch: executes only what the verification plan specifies.
 * - Deterministic aggregation: REQUIRED failures fail the project (NO FALSE SUCCESS).
 * - Read-only filesystem inspection: zero writes, zero mutations, zero process launches.
 */
export function orchestrateProjectVerification({
  verificationId,
  verificationPlan,
  executionResults = [],
  expectedProposalFingerprint = null,
  proposals = null,
  context = {},
  now = Date.now()
}) {
  // Gate 0: Prototype Pollution & Basic Type Defenses
  if (hasPrototypePollution(verificationPlan) || hasPrototypePollution(context)) {
    return Object.freeze({
      verificationId: verificationId || 'unknown',
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Prototype pollution detected in project verification input',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 1: Verification ID validation
  if (!verificationId || typeof verificationId !== 'string' || !isValidIdentifier(verificationId)) {
    return Object.freeze({
      verificationId: verificationId || 'unknown',
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or invalid verificationId string identifier',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 2: Verification Plan validation
  if (!verificationPlan || typeof verificationPlan !== 'object' || Array.isArray(verificationPlan) || !verificationPlan.id) {
    return Object.freeze({
      verificationId,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing or malformed verificationPlan',
      code: ErrorCodes.INVALID_CONTRACT,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 3: Tenant Isolation (Strict match, no fallback, no default)
  const planTenant = verificationPlan.tenantId;
  const callerTenant = context.tenantId || null;
  if (!planTenant || typeof planTenant !== 'string' || planTenant.trim() === '') {
    return Object.freeze({
      verificationId,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing tenantId in verificationPlan. Tenant fallback forbidden',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (callerTenant && callerTenant !== planTenant) {
    return Object.freeze({
      verificationId,
      tenantId: planTenant,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Tenant mismatch: Caller tenant '${callerTenant}' does not match plan tenant '${planTenant}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 4: Workspace Isolation & Path Traversal check
  const planWorkspace = verificationPlan.workspaceId;
  if (!planWorkspace || typeof planWorkspace !== 'string' || planWorkspace.trim() === '') {
    return Object.freeze({
      verificationId,
      tenantId: planTenant,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: 'Missing workspaceId in verificationPlan',
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  const resolvedWorkspace = path.resolve(planWorkspace);
  if (context.workspaceId) {
    const resolvedCallerWorkspace = path.resolve(context.workspaceId);
    if (resolvedWorkspace !== resolvedCallerWorkspace) {
      return Object.freeze({
        verificationId,
        tenantId: planTenant,
        workspaceId: resolvedWorkspace,
        status: ProjectVerificationStatus.VERIFICATION_DENIED,
        outcome: 'DENIED',
        failureReason: `Workspace mismatch: Caller workspace '${resolvedCallerWorkspace}' does not match plan workspace '${resolvedWorkspace}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // Gate 5: Task and Job matching
  if (context.taskId && context.taskId !== verificationPlan.taskId) {
    return Object.freeze({
      verificationId,
      taskId: verificationPlan.taskId,
      tenantId: planTenant,
      workspaceId: resolvedWorkspace,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Task mismatch: Context taskId '${context.taskId}' does not match plan taskId '${verificationPlan.taskId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  if (context.jobId && context.jobId !== verificationPlan.jobId) {
    return Object.freeze({
      verificationId,
      jobId: verificationPlan.jobId,
      tenantId: planTenant,
      workspaceId: resolvedWorkspace,
      status: ProjectVerificationStatus.VERIFICATION_DENIED,
      outcome: 'DENIED',
      failureReason: `Job mismatch: Context jobId '${context.jobId}' does not match plan jobId '${verificationPlan.jobId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  }

  // Gate 6: Proposal Fingerprint validation (Proposal drift defense)
  if (expectedProposalFingerprint && proposals) {
    const actualFingerprint = computeProposalSetFingerprint(proposals);
    if (actualFingerprint !== expectedProposalFingerprint) {
      return Object.freeze({
        verificationId,
        tenantId: planTenant,
        workspaceId: resolvedWorkspace,
        status: ProjectVerificationStatus.VERIFICATION_DENIED,
        outcome: 'DENIED',
        failureReason: 'Proposal fingerprint mismatch: Proposals drifted from approved fingerprint',
        code: ErrorCodes.SECURITY_BLOCKED,
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  }

  // Normalize execution results into lookup map by executionId
  const resultsList = Array.isArray(executionResults)
    ? executionResults
    : (executionResults ? [executionResults] : []);

  const resultsMap = new Map();
  for (const res of resultsList) {
    if (res && typeof res === 'object') {
      const execId = res.executionId || res.id;
      if (execId) {
        // Enforce tenant isolation on each execution result
        if (res.tenantId && res.tenantId !== planTenant) {
          return Object.freeze({
            verificationId,
            tenantId: planTenant,
            workspaceId: resolvedWorkspace,
            status: ProjectVerificationStatus.VERIFICATION_DENIED,
            outcome: 'DENIED',
            failureReason: `Tenant mismatch in execution result '${execId}': Result tenant '${res.tenantId}' does not match plan tenant '${planTenant}'`,
            code: ErrorCodes.SECURITY_BLOCKED,
            authorityGuarantee: DefaultProposalAuthorityGuarantee
          });
        }
        // Enforce task matching on each execution result
        if (res.taskId && res.taskId !== verificationPlan.taskId) {
          return Object.freeze({
            verificationId,
            tenantId: planTenant,
            workspaceId: resolvedWorkspace,
            status: ProjectVerificationStatus.VERIFICATION_DENIED,
            outcome: 'DENIED',
            failureReason: `Task mismatch in execution result '${execId}': Result taskId '${res.taskId}' does not match plan taskId '${verificationPlan.taskId}'`,
            code: ErrorCodes.SECURITY_BLOCKED,
            authorityGuarantee: DefaultProposalAuthorityGuarantee
          });
        }
        resultsMap.set(execId, res);
      }
    }
  }

  // Verify that required executionIds in plan exist in executionResults
  if (verificationPlan.executionIds && verificationPlan.executionIds.length > 0) {
    for (const reqExecId of verificationPlan.executionIds) {
      if (!resultsMap.has(reqExecId)) {
        return Object.freeze({
          verificationId,
          tenantId: planTenant,
          workspaceId: resolvedWorkspace,
          status: ProjectVerificationStatus.VERIFICATION_DENIED,
          outcome: 'DENIED',
          failureReason: `Execution mismatch: Required execution result '${reqExecId}' missing from provided executionResults`,
          code: ErrorCodes.INVALID_CONTRACT,
          authorityGuarantee: DefaultProposalAuthorityGuarantee
        });
      }
    }
  }

  // --- BEGIN DETERMINISTIC CHECK ORCHESTRATION ---
  const checksToRun = verificationPlan.checks || [];
  const checkResults = [];
  const passedChecks = [];
  const failedChecks = [];
  let projectFailed = false;
  let primaryFailureReason = null;

  for (let i = 0; i < checksToRun.length; i++) {
    const chk = checksToRun[i];
    const checkId = chk.id || `chk-${i}`;
    let passed = false;
    let reason = null;
    const observed = {};

    // Validate target security if check references target
    if (chk.target) {
      const targetValidation = validateProposedFileTarget(chk.target);
      if (!targetValidation.valid) {
        return Object.freeze({
          verificationId,
          tenantId: planTenant,
          workspaceId: resolvedWorkspace,
          status: ProjectVerificationStatus.VERIFICATION_DENIED,
          outcome: 'DENIED',
          failureReason: `Security violation in check '${checkId}' target: ${targetValidation.reason}`,
          code: ErrorCodes.SECURITY_BLOCKED,
          authorityGuarantee: DefaultProposalAuthorityGuarantee
        });
      }

      const resolvedTarget = path.resolve(resolvedWorkspace, chk.target);
      if (!isPathInsideDirectory(resolvedTarget, resolvedWorkspace)) {
        return Object.freeze({
          verificationId,
          tenantId: planTenant,
          workspaceId: resolvedWorkspace,
          status: ProjectVerificationStatus.VERIFICATION_DENIED,
          outcome: 'DENIED',
          failureReason: `Security violation in check '${checkId}': Target '${chk.target}' escapes workspace root`,
          code: ErrorCodes.SECURITY_BLOCKED,
          authorityGuarantee: DefaultProposalAuthorityGuarantee
        });
      }
    }

    // Resolve associated execution result for this check
    const boundExecId = chk.executionId || (verificationPlan.executionIds.length > 0 ? verificationPlan.executionIds[0] : null);
    const boundExec = boundExecId ? resultsMap.get(boundExecId) : (resultsList.length > 0 ? resultsList[0] : null);

    // Evaluate according to Check Type
    switch (chk.type) {
      case ProjectCheckType.EXECUTION_RESULT: {
        if (!boundExec) {
          passed = false;
          reason = `No execution result bound for EXECUTION_RESULT check '${checkId}'`;
        } else {
          const expectedOutcome = chk.expected?.outcome || 'SUCCEEDED';
          observed.outcome = boundExec.outcome;
          observed.status = boundExec.status;
          if (boundExec.outcome === expectedOutcome && boundExec.status !== 'FAILED') {
            passed = true;
          } else {
            passed = false;
            reason = `Execution outcome '${boundExec.outcome}' does not match expected '${expectedOutcome}' (status: ${boundExec.status})`;
          }
        }
        break;
      }

      case ProjectCheckType.FILE_STATE:
      case ProjectCheckType.EXPECTED_FILE:
      case ProjectCheckType.ARTIFACT_EXISTS: {
        if (!chk.target) {
          passed = false;
          reason = `Check '${checkId}' requires a target path`;
        } else {
          const targetPath = path.resolve(resolvedWorkspace, chk.target);
          const exists = fs.existsSync(targetPath);
          observed.exists = exists;
          const shouldExist = chk.expected?.shouldExist !== undefined ? chk.expected.shouldExist : true;
          if (exists === shouldExist) {
            passed = true;
          } else {
            passed = false;
            reason = shouldExist
              ? `Expected file/artifact '${chk.target}' does not exist on disk`
              : `File '${chk.target}' expected to be absent still exists on disk`;
          }
        }
        break;
      }

      case ProjectCheckType.FILE_CONTENT:
      case ProjectCheckType.ARTIFACT_CONTENT: {
        if (!chk.target) {
          passed = false;
          reason = `Check '${checkId}' requires a target path`;
        } else {
          const targetPath = path.resolve(resolvedWorkspace, chk.target);
          if (!fs.existsSync(targetPath)) {
            passed = false;
            reason = `Target file '${chk.target}' does not exist for content check`;
          } else {
            const content = fs.readFileSync(targetPath, 'utf-8');
            observed.content = content;
            if (chk.expected?.expectedContent !== undefined) {
              if (content === chk.expected.expectedContent) {
                passed = true;
              } else {
                passed = false;
                reason = `Content of '${chk.target}' does not match expected content`;
              }
            } else if (chk.expected?.contentIncludes) {
              if (content.includes(chk.expected.contentIncludes)) {
                passed = true;
              } else {
                passed = false;
                reason = `Content of '${chk.target}' does not include expected substring`;
              }
            } else {
              passed = true;
            }
          }
        }
        break;
      }

      case ProjectCheckType.UNEXPECTED_FILE: {
        // Checks that target is within expected files
        const expectedList = chk.expected?.expectedFileChanges || [];
        const normalizedExpected = expectedList.map(f => path.resolve(resolvedWorkspace, f));
        if (chk.target) {
          const resolvedTarget = path.resolve(resolvedWorkspace, chk.target);
          if (normalizedExpected.includes(resolvedTarget)) {
            passed = true;
          } else {
            passed = false;
            reason = `Unexpected file modification detected: '${chk.target}' not listed in expectedFileChanges`;
          }
        } else {
          passed = true;
        }
        break;
      }

      case ProjectCheckType.TEST_RESULT:
      case ProjectCheckType.REGRESSION: {
        if (!boundExec) {
          passed = false;
          reason = `No execution result bound for TEST_RESULT check '${checkId}'`;
        } else {
          observed.outcome = boundExec.outcome;
          observed.verificationResult = boundExec.verificationResult;
          const expectedStatus = chk.expected?.status || 'SUCCEEDED';
          if (boundExec.outcome === expectedStatus && boundExec.verificationResult !== 'FAIL') {
            passed = true;
          } else {
            passed = false;
            reason = `Test execution failed: outcome '${boundExec.outcome}', verification '${boundExec.verificationResult}'`;
          }
        }
        break;
      }

      case ProjectCheckType.BUILD_RESULT: {
        if (!boundExec) {
          passed = false;
          reason = `No execution result bound for BUILD_RESULT check '${checkId}'`;
        } else {
          observed.outcome = boundExec.outcome;
          const expectedBuildOutcome = chk.expected?.outcome || 'SUCCEEDED';
          if (boundExec.outcome === expectedBuildOutcome) {
            passed = true;
          } else {
            passed = false;
            reason = `Build execution failed: outcome '${boundExec.outcome}' does not match expected '${expectedBuildOutcome}'`;
          }
        }
        break;
      }

      case ProjectCheckType.PROJECT_CONTRACT: {
        // Validates project structural integrity (e.g. package.json exists and is valid JSON)
        const packageJsonPath = path.resolve(resolvedWorkspace, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          passed = false;
          reason = 'Project contract check failed: package.json missing';
        } else {
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            observed.projectName = pkg.name;
            passed = true;
          } catch (e) {
            passed = false;
            reason = `Project contract check failed: package.json malformed (${e.message})`;
          }
        }
        break;
      }

      default:
        passed = false;
        reason = `Unknown check type: ${chk.type}`;
        break;
    }

    const checkRecord = {
      id: checkId,
      type: chk.type,
      target: chk.target,
      severity: chk.severity,
      status: passed ? ValidationResult.PASS : ValidationResult.FAIL,
      observed: Object.freeze(observed),
      reason
    };

    checkResults.push(checkRecord);
    if (passed) {
      passedChecks.push(checkId);
    } else {
      failedChecks.push(checkId);
      if (chk.severity === CheckSeverity.REQUIRED) {
        projectFailed = true;
        if (!primaryFailureReason) {
          primaryFailureReason = reason || `Required check '${checkId}' failed`;
        }
      }
    }
  }

  const finalStatus = projectFailed
    ? ProjectVerificationStatus.VERIFIED_FAILURE
    : ProjectVerificationStatus.VERIFIED_SUCCESS;

  const verifiedAt = typeof now === 'number' ? new Date(now).toISOString() : new Date().toISOString();

  return createProjectVerificationResult({
    verificationId,
    planId: verificationPlan.id,
    taskId: verificationPlan.taskId,
    jobId: verificationPlan.jobId,
    tenantId: planTenant,
    workspaceId: resolvedWorkspace,
    status: finalStatus,
    totalChecks: checksToRun.length,
    passedCount: passedChecks.length,
    failedCount: failedChecks.length,
    checkResults,
    passedChecks,
    failedChecks,
    failureReason: primaryFailureReason,
    verifiedAt
  });
}
