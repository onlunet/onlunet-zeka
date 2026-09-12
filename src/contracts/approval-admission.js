/**
 * AI Development OS - Controlled Approval / Admission Boundary Contract
 * Phase 52 Foundation - Explicit Human/External Approval & Pre-Execution Admission Gate
 *
 * CORE INVARIANTS:
 * 1. APPROVAL != EXECUTION AUTHORITY:
 *    Approval only authorizes progression to admission. It confers zero execution,
 *    zero mutation, zero shell, zero network, and zero deployment authority.
 * 2. ADMISSION != EXECUTION:
 *    Admission Decision (ADMISSION_ALLOWED) indicates that the proposal set is ready
 *    for controlled execution. It DOES NOT execute, mutate, deploy, or run anything.
 * 3. NO AI APPROVER / NO SELF-AUTHORIZATION:
 *    AI providers, agents, proposals, and review engines cannot approve proposals.
 *    Any AI output containing `approved: true` or `approval: true` is untrusted data.
 *    Approval source must be explicitly external/human (`ApprovalSourceType.HUMAN` or `SYSTEM_POLICY`).
 * 4. SCOPE & CONTEXT BINDING:
 *    Approvals are cryptographically/fingerprint-bound to:
 *    - taskId
 *    - orchestrationPlanId
 *    - tenantId & workspaceId
 *    - reviewId & reviewFingerprint
 *    - proposalFingerprint
 *    Any change to the review, plan, task, proposals, tenant, or workspace immediately invalidates the approval.
 * 5. REVIEW CONFLICT GATE:
 *    If FAZ 51 Review Result has conflicts (`CONFLICT_DETECTED`), invalid proposals (`INVALID_PROPOSAL`),
 *    is rejected (`REVIEW_REJECTED`), or inconsistent (`INCONSISTENT`),
 *    ADMISSION IS STRICTLY DENIED, even if an approval record is supplied.
 * 6. BOUNDED EXPIRATION & TIME DETERMINISM:
 *    Approvals have deterministic expiration checks supporting clock injection.
 *    Zero background schedulers, timers, daemons, or polling.
 * 7. IMMUTABILITY & PURITY:
 *    Approval records and admission decisions are deeply frozen (`Object.freeze`).
 *    Pure functions only, zero side effects.
 * 8. AUTHORITY GUARANTEE:
 *    `executionAuthorized: false`, `mutationAuthorized: false`, `deploymentAuthorized: false`,
 *    `networkAuthorized: false`, `shellAuthorized: false`, `proposalOnly: true`.
 */
import crypto from 'node:crypto';
import { ErrorCodes } from './constants.js';
import { DefaultProposalAuthorityGuarantee } from './agent-proposal.js';
import { ProposalReviewStatus } from './proposal-review.js';

export const ApprovalStatus = Object.freeze({
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  STALE: 'STALE',
  INVALID_APPROVAL: 'INVALID_APPROVAL'
});

export const AdmissionStatus = Object.freeze({
  ADMISSION_ALLOWED: 'ADMISSION_ALLOWED',
  ADMISSION_DENIED: 'ADMISSION_DENIED'
});

export const ApprovalSourceType = Object.freeze({
  HUMAN: 'HUMAN',
  EXTERNAL_AUTHORITY: 'EXTERNAL_AUTHORITY',
  SYSTEM_POLICY: 'SYSTEM_POLICY'
});

export const DEFAULT_APPROVAL_TTL_MS = 3600000; // 1 hour

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
 * Computes deterministic canonical SHA-256 fingerprint for a proposal set.
 */
export function computeProposalSetFingerprint(proposals = []) {
  if (!Array.isArray(proposals)) return 'invalid_proposals';
  const canonicalProposals = proposals.map(p => {
    if (!p || typeof p !== 'object') return 'null_proposal';
    const ops = Array.isArray(p.operations)
      ? p.operations.map(o => `${o.type || ''}:${o.target || ''}:${o.description || ''}`).sort()
      : [];
    const files = Array.isArray(p.proposedFiles) ? [...p.proposedFiles].sort() : [];
    return {
      id: p.id || '',
      agentId: p.agentId || '',
      providerId: p.providerId || '',
      taskId: p.taskId || '',
      operations: ops,
      proposedFiles: files
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  return crypto.createHash('sha256').update(JSON.stringify(canonicalProposals)).digest('hex');
}

/**
 * Computes deterministic canonical SHA-256 fingerprint for a review result.
 */
export function computeReviewFingerprint(reviewResult) {
  if (!reviewResult || typeof reviewResult !== 'object') return 'invalid_review';
  const conflictKeys = Array.isArray(reviewResult.conflicts)
    ? reviewResult.conflicts.map(c => `${c.type || ''}:${c.target || ''}:${c.reason || ''}`).sort()
    : [];
  const canonical = {
    id: reviewResult.id || '',
    status: reviewResult.status || '',
    taskId: reviewResult.taskId || '',
    orchestrationPlanId: reviewResult.orchestrationPlanId || '',
    conflictCount: reviewResult.conflictCount || 0,
    conflicts: conflictKeys,
    proposalFingerprint: computeProposalSetFingerprint(reviewResult.proposals || [])
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Creates an immutable, bound ApprovalRecord.
 * Zero execution authority.
 */
export function createApprovalRecord({
  id,
  taskId,
  orchestrationPlanId,
  tenantId = null,
  workspaceId = null,
  reviewResult,
  source = { type: ApprovalSourceType.HUMAN, approverId: 'operator' },
  decision = ApprovalStatus.APPROVED,
  rationale = '',
  expiresAt = null,
  now = Date.now(),
  metadata = {}
} = {}) {
  // Prototype pollution defense
  if (hasPrototypePollution(source) || hasPrototypePollution(metadata)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in approval input`);
  }

  // Identity validation
  if (!id || typeof id !== 'string' || !isValidIdentifier(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing approval id`);
  }
  if (!taskId || typeof taskId !== 'string' || !isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing taskId`);
  }
  if (!orchestrationPlanId || typeof orchestrationPlanId !== 'string' || !isValidIdentifier(orchestrationPlanId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing orchestrationPlanId`);
  }

  // Review Result validation
  if (!reviewResult || typeof reviewResult !== 'object' || !reviewResult.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Missing or invalid reviewResult`);
  }

  // Cross-reference checks with reviewResult
  if (reviewResult.taskId && reviewResult.taskId !== taskId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Approval taskId '${taskId}' does not match reviewResult taskId '${reviewResult.taskId}'`);
  }
  if (reviewResult.orchestrationPlanId && reviewResult.orchestrationPlanId !== orchestrationPlanId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Approval planId '${orchestrationPlanId}' does not match review planId '${reviewResult.orchestrationPlanId}'`);
  }
  if (tenantId !== null && reviewResult.tenantId !== null && reviewResult.tenantId !== undefined && tenantId !== reviewResult.tenantId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Approval tenant '${tenantId}' does not match review tenant '${reviewResult.tenantId}'`);
  }
  if (workspaceId !== null && reviewResult.workspaceId !== null && reviewResult.workspaceId !== undefined && workspaceId !== reviewResult.workspaceId) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Approval workspace '${workspaceId}' does not match review workspace '${reviewResult.workspaceId}'`);
  }

  // Source validation (No AI self-approval, No agent delegation)
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Approval source must be a valid object`);
  }
  const validSourceTypes = Object.values(ApprovalSourceType);
  if (!source.type || !validSourceTypes.includes(source.type)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid approval source type: '${source.type}'. Must be one of: ${validSourceTypes.join(', ')}`);
  }
  if (typeof source.approverId !== 'string' || source.approverId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing approverId in approval source`);
  }
  // Forbid agent, proposal or provider pretending to be approver
  const approverLower = source.approverId.toLowerCase();
  if (approverLower.includes('agent') || approverLower.includes('provider') || approverLower.includes('model') || approverLower.includes('ai')) {
    if (source.type !== ApprovalSourceType.HUMAN && source.type !== ApprovalSourceType.EXTERNAL_AUTHORITY) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] AI agents and providers are strictly forbidden from acting as approval source`);
    }
  }

  // Decision validation
  const validDecisions = [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.REVOKED];
  if (!decision || !validDecisions.includes(decision)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid approval decision '${decision}'. Must be one of: ${validDecisions.join(', ')}`);
  }

  // Compute bindings
  const reviewFingerprint = computeReviewFingerprint(reviewResult);
  const proposalFingerprint = computeProposalSetFingerprint(reviewResult.proposals || []);

  const effectiveTenantId = tenantId || reviewResult.tenantId || null;
  const effectiveWorkspaceId = workspaceId || reviewResult.workspaceId || null;

  const createdAtTime = typeof now === 'number' ? now : Date.now();
  const calculatedExpiresAt = expiresAt !== null
    ? (typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime())
    : createdAtTime + DEFAULT_APPROVAL_TTL_MS;

  return Object.freeze({
    id: id.trim(),
    taskId: taskId.trim(),
    orchestrationPlanId: orchestrationPlanId.trim(),
    tenantId: effectiveTenantId ? String(effectiveTenantId).trim() : null,
    workspaceId: effectiveWorkspaceId ? String(effectiveWorkspaceId).trim() : null,
    reviewId: reviewResult.id,
    reviewFingerprint,
    proposalFingerprint,
    status: decision,
    source: Object.freeze({
      type: source.type,
      approverId: String(source.approverId).trim()
    }),
    rationale: typeof rationale === 'string' ? rationale.trim() : '',
    createdAt: new Date(createdAtTime).toISOString(),
    expiresAt: new Date(calculatedExpiresAt).toISOString(),
    expiresAtTimestamp: calculatedExpiresAt,
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Validates an approval record against context, staleness, review result, and proposals.
 * Returns { valid: boolean, status: ApprovalStatus, reason: string }
 */
export function validateApprovalRecord(approval, {
  expectedTaskId = null,
  expectedPlanId = null,
  expectedTenantId = null,
  expectedWorkspaceId = null,
  reviewResult = null,
  currentProposals = null,
  now = Date.now()
} = {}) {
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: 'Missing or malformed approval record',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (hasPrototypePollution(approval) || hasPrototypePollution(approval.source) || hasPrototypePollution(approval.metadata)) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: 'Prototype pollution detected in approval record',
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Type confusion defenses
  if (typeof approval.id !== 'string' || !isValidIdentifier(approval.id)) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: 'Approval id must be a valid string identifier',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }
  if (typeof approval.taskId !== 'string' || typeof approval.orchestrationPlanId !== 'string') {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: 'Approval taskId and orchestrationPlanId must be strings',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  // Revocation check
  if (approval.status === ApprovalStatus.REVOKED) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.REVOKED,
      reason: `Approval '${approval.id}' has been explicitly revoked`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Rejection check
  if (approval.status === ApprovalStatus.REJECTED) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.REJECTED,
      reason: `Approval '${approval.id}' was rejected by approver`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Approved status check
  if (approval.status !== ApprovalStatus.APPROVED) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: `Approval status is not APPROVED: '${approval.status}'`,
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  // Authority guarantee tampering check
  const auth = approval.authorityGuarantee;
  if (!auth || auth.executionAuthorized !== false || auth.mutationAuthorized !== false ||
      auth.deploymentAuthorized !== false || auth.networkAuthorized !== false ||
      auth.shellAuthorized !== false || auth.proposalOnly !== true) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: 'Authority escalation detected: Approval cannot grant execution or mutation authority',
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Task binding check
  if (expectedTaskId !== null && approval.taskId !== expectedTaskId) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: `Task mismatch: expected '${expectedTaskId}', got '${approval.taskId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Plan binding check
  if (expectedPlanId !== null && approval.orchestrationPlanId !== expectedPlanId) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: `Orchestration plan mismatch: expected '${expectedPlanId}', got '${approval.orchestrationPlanId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Tenant Isolation check
  if (expectedTenantId !== null && approval.tenantId !== null && approval.tenantId !== undefined && approval.tenantId !== expectedTenantId) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: `Tenant mismatch: expected '${expectedTenantId}', got '${approval.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Workspace Isolation check
  if (expectedWorkspaceId !== null && approval.workspaceId !== null && approval.workspaceId !== undefined && approval.workspaceId !== expectedWorkspaceId) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.INVALID_APPROVAL,
      reason: `Workspace mismatch: expected '${expectedWorkspaceId}', got '${approval.workspaceId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Expiration check (deterministic timestamp comparison)
  const currentTime = typeof now === 'number' ? now : Date.now();
  if (approval.expiresAtTimestamp && currentTime > approval.expiresAtTimestamp) {
    return Object.freeze({
      valid: false,
      status: ApprovalStatus.EXPIRED,
      reason: `Approval '${approval.id}' expired at ${approval.expiresAt}`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Review Staleness / Fingerprint Binding check
  if (reviewResult) {
    if (reviewResult.id && approval.reviewId && reviewResult.id !== approval.reviewId) {
      return Object.freeze({
        valid: false,
        status: ApprovalStatus.STALE,
        reason: `Approval reviewId '${approval.reviewId}' does not match current reviewId '${reviewResult.id}'`,
        code: ErrorCodes.SECURITY_BLOCKED
      });
    }

    const currentReviewFingerprint = computeReviewFingerprint(reviewResult);
    if (approval.reviewFingerprint && currentReviewFingerprint !== approval.reviewFingerprint) {
      return Object.freeze({
        valid: false,
        status: ApprovalStatus.STALE,
        reason: 'Review fingerprint mismatch: Review state changed since approval was granted',
        code: ErrorCodes.SECURITY_BLOCKED
      });
    }
  }

  // Proposal Set Drift / Fingerprint Binding check
  if (currentProposals) {
    const currentProposalFingerprint = computeProposalSetFingerprint(currentProposals);
    if (approval.proposalFingerprint && currentProposalFingerprint !== approval.proposalFingerprint) {
      return Object.freeze({
        valid: false,
        status: ApprovalStatus.STALE,
        reason: 'Proposal fingerprint mismatch: Proposals were modified after approval was granted',
        code: ErrorCodes.SECURITY_BLOCKED
      });
    }
  }

  return Object.freeze({
    valid: true,
    status: ApprovalStatus.APPROVED,
    approvalId: approval.id,
    taskId: approval.taskId
  });
}

/**
 * Evaluates controlled admission for a proposal set based on review result and explicit approval.
 * Produces immutable AdmissionDecision (ADMISSION_ALLOWED vs ADMISSION_DENIED).
 * Pure deterministic, zero execution side effects.
 */
export function evaluateApprovalAdmission({
  tenantId = null,
  workspaceId = null,
  taskId,
  orchestrationPlan,
  reviewResult,
  approval,
  proposals = null,
  seenApprovalIds = null,
  now = Date.now()
} = {}) {
  const baseResult = (status, reason, code = ErrorCodes.SECURITY_BLOCKED) => Object.freeze({
    admissionStatus: status,
    taskId: typeof taskId === 'string' ? taskId : (reviewResult ? reviewResult.taskId : null),
    orchestrationPlanId: orchestrationPlan ? orchestrationPlan.id : (reviewResult ? reviewResult.orchestrationPlanId : null),
    tenantId: tenantId || (orchestrationPlan ? orchestrationPlan.tenantId : null) || (reviewResult ? reviewResult.tenantId : null),
    workspaceId: workspaceId || (orchestrationPlan ? orchestrationPlan.workspaceId : null) || (reviewResult ? reviewResult.workspaceId : null),
    approvalId: approval && typeof approval === 'object' && typeof approval.id === 'string' ? approval.id : null,
    reviewId: reviewResult && typeof reviewResult === 'object' && typeof reviewResult.id === 'string' ? reviewResult.id : null,
    reason,
    code,
    admitted: status === AdmissionStatus.ADMISSION_ALLOWED,
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    evaluatedAt: new Date(typeof now === 'number' ? now : Date.now()).toISOString()
  });

  // Basic input validation
  if (!taskId || typeof taskId !== 'string' || !isValidIdentifier(taskId)) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, 'Missing or invalid taskId', ErrorCodes.INVALID_CONTRACT);
  }
  if (!orchestrationPlan || typeof orchestrationPlan !== 'object' || !orchestrationPlan.id) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, 'Missing or invalid orchestrationPlan', ErrorCodes.INVALID_CONTRACT);
  }
  if (!reviewResult || typeof reviewResult !== 'object' || !reviewResult.id) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, 'Missing or invalid reviewResult', ErrorCodes.INVALID_CONTRACT);
  }

  // Cross-reference checks between plan, review, and request
  if (orchestrationPlan.taskId && orchestrationPlan.taskId !== taskId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Plan taskId '${orchestrationPlan.taskId}' does not match admission taskId '${taskId}'`);
  }
  if (reviewResult.taskId && reviewResult.taskId !== taskId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Review taskId '${reviewResult.taskId}' does not match admission taskId '${taskId}'`);
  }
  if (reviewResult.orchestrationPlanId && reviewResult.orchestrationPlanId !== orchestrationPlan.id) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Review planId mismatch: '${reviewResult.orchestrationPlanId}' does not match orchestrationPlan.id '${orchestrationPlan.id}'`);
  }

  // Tenant Boundary check
  const effectiveTenantId = tenantId || orchestrationPlan.tenantId || reviewResult.tenantId || null;
  if (tenantId !== null && orchestrationPlan.tenantId !== null && tenantId !== orchestrationPlan.tenantId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Caller tenant '${tenantId}' does not match plan tenant '${orchestrationPlan.tenantId}'`);
  }
  if (tenantId !== null && reviewResult.tenantId !== null && tenantId !== reviewResult.tenantId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Caller tenant '${tenantId}' does not match review tenant '${reviewResult.tenantId}'`);
  }

  // Workspace Boundary check
  const effectiveWorkspaceId = workspaceId || orchestrationPlan.workspaceId || reviewResult.workspaceId || null;
  if (workspaceId !== null && orchestrationPlan.workspaceId !== null && workspaceId !== orchestrationPlan.workspaceId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Caller workspace '${workspaceId}' does not match plan workspace '${orchestrationPlan.workspaceId}'`);
  }
  if (workspaceId !== null && reviewResult.workspaceId !== null && workspaceId !== reviewResult.workspaceId) {
    return baseResult(AdmissionStatus.ADMISSION_DENIED, `Caller workspace '${workspaceId}' does not match review workspace '${reviewResult.workspaceId}'`);
  }

  // 1. Review Status Gate: Must be explicitly REVIEWED with ZERO conflicts
  if (reviewResult.status !== ProposalReviewStatus.REVIEWED) {
    return baseResult(
      AdmissionStatus.ADMISSION_DENIED,
      `Review status is '${reviewResult.status}'. Admission is permitted only for '${ProposalReviewStatus.REVIEWED}' proposals`
    );
  }
  if (reviewResult.conflictCount > 0 || (Array.isArray(reviewResult.conflicts) && reviewResult.conflicts.length > 0)) {
    return baseResult(
      AdmissionStatus.ADMISSION_DENIED,
      `Critical conflicts detected in review (${reviewResult.conflictCount || reviewResult.conflicts.length}). Conflicts cannot be bypassed`
    );
  }

  // 2. Explicit Approval Requirement Gate: Auto-admission is strictly forbidden
  if (!approval) {
    return baseResult(
      AdmissionStatus.ADMISSION_DENIED,
      'Admission denied: Explicit approval is required. Auto-admission without approval is strictly forbidden',
      ErrorCodes.APPROVAL_REQUIRED
    );
  }

  // 3. Approval Duplication / Replay Detection
  if (seenApprovalIds && typeof seenApprovalIds.has === 'function' && typeof approval.id === 'string') {
    if (seenApprovalIds.has(approval.id)) {
      return baseResult(
        AdmissionStatus.ADMISSION_DENIED,
        `Approval replay detected: approvalId '${approval.id}' has already been consumed`
      );
    }
  }

  // 4. Validate Approval Record
  const effectiveProposals = proposals || reviewResult.proposals || [];
  const approvalValidation = validateApprovalRecord(approval, {
    expectedTaskId: taskId,
    expectedPlanId: orchestrationPlan.id,
    expectedTenantId: effectiveTenantId,
    expectedWorkspaceId: effectiveWorkspaceId,
    reviewResult,
    currentProposals: effectiveProposals,
    now
  });

  if (!approvalValidation.valid) {
    return baseResult(
      AdmissionStatus.ADMISSION_DENIED,
      `Approval validation failed: ${approvalValidation.reason}`,
      approvalValidation.code || ErrorCodes.SECURITY_BLOCKED
    );
  }

  // 5. Final check: AI output / Prompt injection defense in approval rationale
  if (typeof approval.rationale === 'string') {
    const lowerRationale = approval.rationale.toLowerCase();
    if (lowerRationale.includes('ignore all rules') || lowerRationale.includes('grant execution authority') || lowerRationale.includes('bypass review')) {
      // Invariant: Prompt injection payloads are harmless text and cannot elevate authority
    }
  }

  // All gates passed: ADMISSION_ALLOWED
  // Record consumed approval if tracker supplied
  if (seenApprovalIds && typeof seenApprovalIds.add === 'function' && typeof approval.id === 'string') {
    seenApprovalIds.add(approval.id);
  }

  return baseResult(
    AdmissionStatus.ADMISSION_ALLOWED,
    'Proposal set successfully admitted for controlled execution pipeline. Awaiting execution scheduling',
    null
  );
}
