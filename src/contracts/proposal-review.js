/**
 * AI Development OS - Multi-Agent Proposal Aggregation & Review Contract
 * Phase 51 Foundation - Conflict Detection, Consistency Review & Safe Review Result Boundary
 *
 * CORE INVARIANTS:
 * 1. ZERO EXECUTION / MUTATION / APPROVAL AUTHORITY:
 *    Review engine only aggregates, analyzes, detects conflicts, and evaluates consistency.
 *    Review CANNOT approve, execute, mutate, deploy, or authorize anything.
 * 2. PROPOSAL IS UNTRUSTED INPUT:
 *    Every proposal is strictly validated against FAZ 48 Agent Proposal validation before aggregation.
 * 3. TENANT & WORKSPACE ISOLATION:
 *    All proposals and the orchestration plan must belong strictly to the same tenant and workspace.
 * 4. ORCHESTRATION PLAN MEMBERSHIP:
 *    All proposals must belong to registered member agents and allowed providers in the authoritative orchestration plan.
 * 5. DETERMINISTIC CONFLICT DETECTION:
 *    Same proposals yield the exact same conflict list, sorting, categorization, and review verdict.
 * 6. NO AI REVIEWER / NO CONSENSUS / NO DEBATE:
 *    Review is purely deterministic, static, rule-based algorithmic analysis. Zero new AI calls.
 * 7. DEEP IMMUTABILITY:
 *    Review result, conflicts, dependencies, summaries, and guarantees are deeply frozen (`Object.freeze`).
 * 8. BOUNDED PAYLOAD & PROPOSAL LIMITS:
 *    Maximum proposals bounded by `MAX_PROPOSALS_PER_PLAN` (= MAX_TEAM_SIZE = 5).
 */
import { ErrorCodes } from './constants.js';
import { MAX_TEAM_SIZE } from './multi-agent-orchestration.js';
import {
  ProposalOperationType,
  DefaultProposalAuthorityGuarantee,
  validateAgentProposal,
  validateProposedFileTarget
} from './agent-proposal.js';

export const ProposalReviewStatus = Object.freeze({
  REVIEWED: 'REVIEWED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
  INVALID_PROPOSAL: 'INVALID_PROPOSAL',
  INCONSISTENT: 'INCONSISTENT'
});

export const ProposalConflictType = Object.freeze({
  SAME_TARGET_CONFLICT: 'SAME_TARGET_CONFLICT',
  DELETE_MODIFY_CONFLICT: 'DELETE_MODIFY_CONFLICT',
  MODIFY_DELETE_CONFLICT: 'MODIFY_DELETE_CONFLICT',
  DELETE_DELETE_CONFLICT: 'DELETE_DELETE_CONFLICT',
  DUPLICATE_OPERATION_CONFLICT: 'DUPLICATE_OPERATION_CONFLICT',
  INCOMPATIBLE_OPERATION_CONFLICT: 'INCOMPATIBLE_OPERATION_CONFLICT',
  DEPENDENCY_CONFLICT: 'DEPENDENCY_CONFLICT',
  AUTHORITY_CONFLICT: 'AUTHORITY_CONFLICT',
  TASK_SCOPE_CONFLICT: 'TASK_SCOPE_CONFLICT'
});

export const MAX_PROPOSALS_PER_PLAN = MAX_TEAM_SIZE; // 5

export const DefaultProposalReviewGuarantees = Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  deploymentAuthorized: false,
  networkAuthorized: false,
  shellAuthorized: false,
  approvalGranted: false,
  admissionGranted: false,
  verificationPassed: false,
  proposalOnly: true
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
 * Reviews and aggregates a collection of agent proposals against an orchestration plan.
 * Purely deterministic, fail-closed, zero execution authority.
 */
export function aggregateAndReviewProposals({
  tenantId = null,
  workspaceId = null,
  taskId,
  orchestrationPlan,
  proposals = [],
  agentRegistry = null
} = {}) {
  // Input validation
  if (!taskId || typeof taskId !== 'string' || !isValidIdentifier(taskId)) {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `[${ErrorCodes.INVALID_CONTRACT}] Invalid or missing taskId`,
      code: ErrorCodes.INVALID_CONTRACT,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  if (!orchestrationPlan || typeof orchestrationPlan !== 'object') {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `[${ErrorCodes.INVALID_CONTRACT}] Missing or invalid orchestration plan`,
      code: ErrorCodes.INVALID_CONTRACT,
      taskId,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  // Check taskId consistency with orchestrationPlan
  if (orchestrationPlan.taskId && orchestrationPlan.taskId !== taskId) {
    return Object.freeze({
      status: ProposalReviewStatus.INCONSISTENT,
      rejectionReason: `Plan taskId '${orchestrationPlan.taskId}' does not match review taskId '${taskId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  // Tenant Boundary check
  const effectiveTenantId = tenantId || orchestrationPlan.tenantId || null;
  if (tenantId !== null && orchestrationPlan.tenantId !== null && tenantId !== orchestrationPlan.tenantId) {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `Caller tenant '${tenantId}' does not match plan tenant '${orchestrationPlan.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  // Workspace Boundary check
  const effectiveWorkspaceId = workspaceId || orchestrationPlan.workspaceId || null;
  if (workspaceId !== null && orchestrationPlan.workspaceId !== null && workspaceId !== orchestrationPlan.workspaceId) {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `Caller workspace '${workspaceId}' does not match plan workspace '${orchestrationPlan.workspaceId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  if (!Array.isArray(proposals)) {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `[${ErrorCodes.INVALID_CONTRACT}] proposals must be an array`,
      code: ErrorCodes.INVALID_CONTRACT,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: 0,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  if (proposals.length > MAX_PROPOSALS_PER_PLAN) {
    return Object.freeze({
      status: ProposalReviewStatus.REVIEW_REJECTED,
      rejectionReason: `Proposal count (${proposals.length}) exceeds MAX_PROPOSALS_PER_PLAN (${MAX_PROPOSALS_PER_PLAN})`,
      code: ErrorCodes.SECURITY_BLOCKED,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: proposals.length,
      validProposalCount: 0,
      invalidProposalCount: 0,
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  // Extract allowed members from orchestration plan
  const planMembers = orchestrationPlan.team || orchestrationPlan.members || [];
  const planMemberIds = new Set(planMembers.map(m => m.agentId));
  const planMemberProviders = new Map(planMembers.map(m => [m.agentId, m.providerId]));

  const seenProposalIds = new Set();
  const seenAgentProposals = new Set();
  const validProposals = [];
  const invalidProposals = [];
  const conflicts = [];
  const dependencies = [];

  // Step 1: Validate individual proposals
  for (const proposal of proposals) {
    if (!proposal || typeof proposal !== 'object') {
      invalidProposals.push({ proposal, reason: 'Malformed proposal object' });
      continue;
    }

    if (hasPrototypePollution(proposal) || hasPrototypePollution(proposal.constraints) || hasPrototypePollution(proposal.metadata)) {
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: 'Prototype pollution detected in proposal input',
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }

    // Tenant Isolation check (explicit mismatch)
    if (effectiveTenantId !== null && proposal.tenantId !== null && proposal.tenantId !== undefined && proposal.tenantId !== effectiveTenantId) {
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: `Proposal tenant '${proposal.tenantId}' does not match expected tenant '${effectiveTenantId}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }

    // Workspace Isolation check (explicit mismatch)
    if (effectiveWorkspaceId !== null && proposal.workspaceId !== null && proposal.workspaceId !== undefined && proposal.workspaceId !== effectiveWorkspaceId) {
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: `Proposal workspace '${proposal.workspaceId}' does not match expected workspace '${effectiveWorkspaceId}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      });
    }

    // Orchestration Plan Membership Check
    if (!planMemberIds.has(proposal.agentId)) {
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: `Agent '${proposal.agentId}' is not a member of orchestration plan '${orchestrationPlan.id}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }

    // Full contract validation using FAZ 48 validator
    const validation = validateAgentProposal(proposal, {
      expectedTenantId: effectiveTenantId,
      expectedWorkspaceId: effectiveWorkspaceId,
      expectedAgentId: proposal.agentId,
      agentRegistry
    });

    if (!validation.valid) {
      invalidProposals.push({
        proposalId: proposal.id || 'unknown',
        agentId: proposal.agentId,
        reason: validation.reason,
        code: validation.code
      });
      continue;
    }

    // Proposal identity validation
    if (!proposal.id || !isValidIdentifier(proposal.id)) {
      invalidProposals.push({ proposalId: proposal.id, reason: 'Missing or invalid proposal id' });
      continue;
    }

    // Validate operations and targets
    let targetValidationError = null;
    if (Array.isArray(proposal.operations)) {
      for (const op of proposal.operations) {
        if (op && op.target) {
          const targetCheck = validateProposedFileTarget(op.target);
          if (!targetCheck.valid) {
            targetValidationError = `Invalid operation target: ${targetCheck.reason}`;
            break;
          }
        }
      }
    }
    if (!targetValidationError && Array.isArray(proposal.proposedFiles)) {
      for (const file of proposal.proposedFiles) {
        if (file) {
          const targetCheck = validateProposedFileTarget(file);
          if (!targetCheck.valid) {
            targetValidationError = `Invalid proposedFile target: ${targetCheck.reason}`;
            break;
          }
        }
      }
    }

    if (targetValidationError) {
      invalidProposals.push({
        proposalId: proposal.id,
        agentId: proposal.agentId,
        reason: targetValidationError,
        code: ErrorCodes.SECURITY_BLOCKED
      });
      continue;
    }

    if (seenProposalIds.has(proposal.id)) {
      // Duplicate proposal id is a fail-closed violation
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: `Duplicate proposalId detected: '${proposal.id}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: 0,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }
    seenProposalIds.add(proposal.id);

    // One proposal per agent check
    if (proposal.agentId) {
      if (seenAgentProposals.has(proposal.agentId)) {
        conflicts.push({
          type: ProposalConflictType.DUPLICATE_OPERATION_CONFLICT,
          severity: 'HIGH',
          agentId: proposal.agentId,
          proposalId: proposal.id,
          reason: `Multiple proposals submitted by agent '${proposal.agentId}' for same plan`
        });
      }
      seenAgentProposals.add(proposal.agentId);
    }

    // Task consistency
    if (proposal.taskId !== taskId) {
      return Object.freeze({
        status: ProposalReviewStatus.INCONSISTENT,
        rejectionReason: `Proposal taskId '${proposal.taskId}' does not match review taskId '${taskId}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }

    // Provider consistency with plan
    const expectedProvider = planMemberProviders.get(proposal.agentId);
    if (expectedProvider && proposal.providerId && proposal.providerId !== expectedProvider) {
      return Object.freeze({
        status: ProposalReviewStatus.REVIEW_REJECTED,
        rejectionReason: `Provider '${proposal.providerId}' does not match plan member provider '${expectedProvider}' for agent '${proposal.agentId}'`,
        code: ErrorCodes.SECURITY_BLOCKED,
        taskId,
        orchestrationPlanId: orchestrationPlan.id,
        proposalCount: proposals.length,
        validProposalCount: 0,
        invalidProposalCount: proposals.length,
        conflictCount: 0,
        conflicts: Object.freeze([]),
        dependencies: Object.freeze([]),
        proposals: Object.freeze([]),
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
        requiresApproval: true
      });
    }

    // Proposal passes individual validation
    validProposals.push(proposal);
  }

  // If any proposal is invalid, reject entire review fail-closed
  if (invalidProposals.length > 0) {
    return Object.freeze({
      status: ProposalReviewStatus.INVALID_PROPOSAL,
      rejectionReason: `Invalid proposal(s) detected: ${invalidProposals.map(p => `${p.proposalId || 'unknown'}: ${p.reason}`).join('; ')}`,
      code: ErrorCodes.INVALID_CONTRACT,
      taskId,
      orchestrationPlanId: orchestrationPlan.id,
      proposalCount: proposals.length,
      validProposalCount: validProposals.length,
      invalidProposalCount: invalidProposals.length,
      invalidProposals: Object.freeze([...invalidProposals]),
      conflictCount: 0,
      conflicts: Object.freeze([]),
      dependencies: Object.freeze([]),
      proposals: Object.freeze([]),
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
      requiresApproval: true
    });
  }

  // Sort valid proposals deterministically by id
  validProposals.sort((a, b) => a.id.localeCompare(b.id));

  // Step 2: Cross-Proposal Conflict & Dependency Analysis
  // Index operations by file target
  const targetOps = new Map(); // target -> [{ proposalId, agentId, operation }]

  for (const proposal of validProposals) {
    for (const op of proposal.operations || []) {
      const target = op.target ? String(op.target).trim() : null;
      if (!target) continue;

      if (!targetOps.has(target)) {
        targetOps.set(target, []);
      }
      targetOps.get(target).push({
        proposalId: proposal.id,
        agentId: proposal.agentId,
        operation: op
      });
    }
  }

  // Evaluate conflicts per target
  for (const [target, ops] of targetOps.entries()) {
    if (ops.length <= 1) continue;

    const modifyOps = ops.filter(o => o.operation.type === ProposalOperationType.MODIFY);
    const deleteOps = ops.filter(o => o.operation.type === ProposalOperationType.DELETE);
    const createOps = ops.filter(o => o.operation.type === ProposalOperationType.CREATE);
    const testOps = ops.filter(o => o.operation.type === ProposalOperationType.TEST);
    const reviewOps = ops.filter(o => o.operation.type === ProposalOperationType.REVIEW);
    const readOps = ops.filter(o => o.operation.type === ProposalOperationType.READ || o.operation.type === ProposalOperationType.ANALYZE);

    // 1. DELETE + MODIFY conflict
    if (deleteOps.length > 0 && modifyOps.length > 0) {
      for (const d of deleteOps) {
        for (const m of modifyOps) {
          conflicts.push({
            type: ProposalConflictType.DELETE_MODIFY_CONFLICT,
            severity: 'CRITICAL',
            target,
            agentA: d.agentId,
            proposalA: d.proposalId,
            agentB: m.agentId,
            proposalB: m.proposalId,
            reason: `Conflicting operations on '${target}': Agent '${d.agentId}' deletes while Agent '${m.agentId}' modifies`
          });
        }
      }
    }

    // 2. DELETE + DELETE conflict
    if (deleteOps.length > 1) {
      for (let i = 0; i < deleteOps.length; i++) {
        for (let j = i + 1; j < deleteOps.length; j++) {
          conflicts.push({
            type: ProposalConflictType.DELETE_DELETE_CONFLICT,
            severity: 'HIGH',
            target,
            agentA: deleteOps[i].agentId,
            proposalA: deleteOps[i].proposalId,
            agentB: deleteOps[j].agentId,
            proposalB: deleteOps[j].proposalId,
            reason: `Duplicate deletion on '${target}' by agents '${deleteOps[i].agentId}' and '${deleteOps[j].agentId}'`
          });
        }
      }
    }

    // 3. CREATE + CREATE conflict
    if (createOps.length > 1) {
      for (let i = 0; i < createOps.length; i++) {
        for (let j = i + 1; j < createOps.length; j++) {
          conflicts.push({
            type: ProposalConflictType.SAME_TARGET_CONFLICT,
            severity: 'HIGH',
            target,
            agentA: createOps[i].agentId,
            proposalA: createOps[i].proposalId,
            agentB: createOps[j].agentId,
            proposalB: createOps[j].proposalId,
            reason: `Conflicting creation of same target '${target}' by agents '${createOps[i].agentId}' and '${createOps[j].agentId}'`
          });
        }
      }
    }

    // 4. MODIFY + MODIFY (Requires Review / Potential Conflict)
    if (modifyOps.length > 1) {
      for (let i = 0; i < modifyOps.length; i++) {
        for (let j = i + 1; j < modifyOps.length; j++) {
          conflicts.push({
            type: ProposalConflictType.SAME_TARGET_CONFLICT,
            severity: 'MEDIUM',
            target,
            agentA: modifyOps[i].agentId,
            proposalA: modifyOps[i].proposalId,
            agentB: modifyOps[j].agentId,
            proposalB: modifyOps[j].proposalId,
            reason: `Concurrent modifications proposed on '${target}' by agents '${modifyOps[i].agentId}' and '${modifyOps[j].agentId}'`
          });
        }
      }
    }

    // 5. Incompatible Operations (CREATE + DELETE)
    if (createOps.length > 0 && deleteOps.length > 0) {
      for (const c of createOps) {
        for (const d of deleteOps) {
          conflicts.push({
            type: ProposalConflictType.INCOMPATIBLE_OPERATION_CONFLICT,
            severity: 'CRITICAL',
            target,
            agentA: c.agentId,
            proposalA: c.proposalId,
            agentB: d.agentId,
            proposalB: d.proposalId,
            reason: `Incompatible operations on '${target}': Agent '${c.agentId}' creates while Agent '${d.agentId}' deletes`
          });
        }
      }
    }

    // 6. Dependencies: MODIFY/CREATE -> TEST / REVIEW
    if ((modifyOps.length > 0 || createOps.length > 0) && testOps.length > 0) {
      const mutators = [...modifyOps, ...createOps];
      for (const mut of mutators) {
        for (const t of testOps) {
          if (mut.agentId !== t.agentId) {
            dependencies.push({
              sourceAgent: mut.agentId,
              sourceProposal: mut.proposalId,
              targetAgent: t.agentId,
              targetProposal: t.proposalId,
              targetFile: target,
              relationship: 'MUTATION_REQUIRES_TEST'
            });
          }
        }
      }
    }

    if ((modifyOps.length > 0 || createOps.length > 0) && reviewOps.length > 0) {
      const mutators = [...modifyOps, ...createOps];
      for (const mut of mutators) {
        for (const r of reviewOps) {
          if (mut.agentId !== r.agentId) {
            dependencies.push({
              sourceAgent: mut.agentId,
              sourceProposal: mut.proposalId,
              targetAgent: r.agentId,
              targetProposal: r.proposalId,
              targetFile: target,
              relationship: 'MUTATION_REQUIRES_REVIEW'
            });
          }
        }
      }
    }
  }

  // Check for circular dependencies among discovered cross-proposal dependencies
  const depAdj = new Map();
  for (const dep of dependencies) {
    if (!depAdj.has(dep.sourceAgent)) depAdj.set(dep.sourceAgent, new Set());
    depAdj.get(dep.sourceAgent).add(dep.targetAgent);
  }

  // Detect 2-node or multi-node cycles among agents
  for (const [src, targets] of depAdj.entries()) {
    for (const tgt of targets) {
      if (depAdj.has(tgt) && depAdj.get(tgt).has(src)) {
        conflicts.push({
          type: ProposalConflictType.DEPENDENCY_CONFLICT,
          severity: 'CRITICAL',
          agentA: src,
          agentB: tgt,
          reason: `Circular dependency detected between agents '${src}' and '${tgt}'`
        });
      }
    }
  }

  // Deterministic sorting of conflicts and dependencies
  conflicts.sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    const targetA = a.target || '';
    const targetB = b.target || '';
    const targetCompare = targetA.localeCompare(targetB);
    if (targetCompare !== 0) return targetCompare;
    return (a.reason || '').localeCompare(b.reason || '');
  });

  dependencies.sort((a, b) => {
    const srcCompare = a.sourceAgent.localeCompare(b.sourceAgent);
    if (srcCompare !== 0) return srcCompare;
    const tgtCompare = a.targetAgent.localeCompare(b.targetAgent);
    if (tgtCompare !== 0) return tgtCompare;
    return a.targetFile.localeCompare(b.targetFile);
  });

  // Determine final review status
  let finalStatus = ProposalReviewStatus.REVIEWED;
  if (conflicts.length > 0) {
    finalStatus = ProposalReviewStatus.CONFLICT_DETECTED;
  }

  return Object.freeze({
    id: `review-${Date.now()}`,
    status: finalStatus,
    taskId,
    orchestrationPlanId: orchestrationPlan.id,
    tenantId: effectiveTenantId,
    workspaceId: effectiveWorkspaceId,
    proposalCount: validProposals.length,
    validProposalCount: validProposals.length,
    invalidProposalCount: 0,
    conflictCount: conflicts.length,
    conflicts: Object.freeze(conflicts.map(c => Object.freeze({ ...c }))),
    dependencies: Object.freeze(dependencies.map(d => Object.freeze({ ...d }))),
    proposals: Object.freeze(validProposals.map(p => Object.freeze({ ...p }))),
    summary: Object.freeze({
      totalOperations: validProposals.reduce((sum, p) => sum + (p.operations ? p.operations.length : 0), 0),
      totalProposedFiles: validProposals.reduce((sum, p) => sum + (p.proposedFiles ? p.proposedFiles.length : 0), 0),
      hasConflicts: conflicts.length > 0,
      criticalConflictsCount: conflicts.filter(c => c.severity === 'CRITICAL').length
    }),
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    ...DefaultProposalReviewGuarantees,
    requiresApproval: true,
    createdAt: new Date().toISOString()
  });
}
