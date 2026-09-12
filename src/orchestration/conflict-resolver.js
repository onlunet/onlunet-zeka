/**
 * ONLUNET ZEKA - Multi-Agent Conflict Resolver
 * FAZ 58 Foundation: Declarative Resolution Strategies for Conflicting Proposals
 *
 * Strategies:
 * - CONSENSUS: Requires unanimous agreement
 * - MAJORITY: Selects majority position; ties remain unresolved
 * - SECURITY_VETO: Security agent findings veto unsafe proposals
 * - HIGHEST_CONFIDENCE: Selects highest confidence proposal (advisory only)
 * - REVIEW_REQUIRED / HUMAN_REQUIRED: Defers to human operator
 *
 * INVARIANT: Resolution produces PROPOSALS ONLY. Zero execution authority.
 */
import { DefaultProposalAuthorityGuarantee } from '../contracts/agent-proposal.js';

export const ConflictResolutionStrategy = Object.freeze({
  CONSENSUS: 'CONSENSUS',
  MAJORITY: 'MAJORITY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  SECURITY_VETO: 'SECURITY_VETO',
  HIGHEST_CONFIDENCE: 'HIGHEST_CONFIDENCE',
  HUMAN_REQUIRED: 'HUMAN_REQUIRED'
});

export const ResolutionStatus = Object.freeze({
  RESOLVED: 'RESOLVED',
  UNRESOLVED: 'UNRESOLVED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  VETOED: 'VETOED',
  NO_CONFLICT: 'NO_CONFLICT'
});

export const DefaultResolutionAuthorityGuarantee = Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  consensusAuthorityGranted: false,
  requiresHumanApproval: true,
  proposalOnly: true
});

export function resolveAgentConflicts(arg1 = {}, arg2 = {}) {
  let conflicts = [];
  let proposals = [];
  let strategy = ConflictResolutionStrategy.REVIEW_REQUIRED;
  let agentRegistry = null;

  if (Array.isArray(arg1)) {
    proposals = arg1;
    if (arg2 && typeof arg2 === 'object') {
      conflicts = arg2.conflicts || [];
      strategy = arg2.strategy || ConflictResolutionStrategy.REVIEW_REQUIRED;
      agentRegistry = arg2.agentRegistry || null;
    }
  } else if (arg1 && typeof arg1 === 'object') {
    conflicts = arg1.conflicts || [];
    proposals = arg1.proposals || [];
    strategy = arg1.strategy || ConflictResolutionStrategy.REVIEW_REQUIRED;
    agentRegistry = arg1.agentRegistry || null;
  }

  const proposalList = Array.isArray(proposals) ? [...proposals] : [];
  const conflictList = Array.isArray(conflicts) ? [...conflicts] : [];

  // If there are no conflicts, proposals stand cleanly
  if (conflictList.length === 0) {
    const isConsensusStrategy = strategy === ConflictResolutionStrategy.CONSENSUS;
    return Object.freeze({
      status: isConsensusStrategy ? ResolutionStatus.RESOLVED : ResolutionStatus.NO_CONFLICT,
      strategy,
      consensusReached: true,
      resolvedProposals: Object.freeze(proposalList),
      rejectedProposals: Object.freeze([]),
      conflicts: Object.freeze([]),
      resolutionSummary: isConsensusStrategy
        ? 'Unanimous consensus reached across agent proposals.'
        : 'No conflicting operations detected across agent proposals.',
      ...DefaultResolutionAuthorityGuarantee,
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // 1. HUMAN_REQUIRED or REVIEW_REQUIRED
  if (strategy === ConflictResolutionStrategy.REVIEW_REQUIRED || strategy === ConflictResolutionStrategy.HUMAN_REQUIRED) {
    return Object.freeze({
      status: ResolutionStatus.REVIEW_REQUIRED,
      strategy,
      resolvedProposals: Object.freeze([]),
      rejectedProposals: Object.freeze([]),
      conflicts: Object.freeze(conflictList),
      resolutionSummary: `Conflicts detected (${conflictList.length}). Human operator review required.`,
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // 2. CONSENSUS (Unanimity required)
  if (strategy === ConflictResolutionStrategy.CONSENSUS) {
    return Object.freeze({
      status: ResolutionStatus.UNRESOLVED,
      strategy,
      resolvedProposals: Object.freeze([]),
      rejectedProposals: Object.freeze([]),
      conflicts: Object.freeze(conflictList),
      resolutionSummary: `Consensus failed: ${conflictList.length} conflict(s) detected across proposals.`,
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // 3. SECURITY_VETO
  if (strategy === ConflictResolutionStrategy.SECURITY_VETO) {
    // Find security agents among proposals or in registry
    const securityAgentIds = new Set();
    for (const p of proposalList) {
      const role = String(p.role || (p.metadata && p.metadata.role) || (p.metadata && p.metadata.agentRole) || '').toUpperCase();
      if (role === 'SECURITY' || role === 'SECURITY_ENGINEER' || role === 'SECURITY_AUDITOR') {
        securityAgentIds.add(p.agentId);
      } else if (agentRegistry && agentRegistry.has(p.agentId)) {
        const def = agentRegistry.get(p.agentId);
        if (def && (def.role === 'SECURITY' || (def.capabilities && def.capabilities.includes('security_review')))) {
          securityAgentIds.add(p.agentId);
        }
      }
    }

    // Check if security raised conflicts or rejected operations
    const vetoedTargets = new Set();
    for (const c of conflictList) {
      if (securityAgentIds.has(c.agentA) || securityAgentIds.has(c.agentB)) {
        if (c.target) vetoedTargets.add(c.target);
      }
    }

    if (vetoedTargets.size > 0) {
      const retainedProposals = [];
      const rejectedProposals = [];

      for (const p of proposalList) {
        const hasVetoedOp = (p.operations || []).some(op => vetoedTargets.has(op.target));
        if (hasVetoedOp && !securityAgentIds.has(p.agentId)) {
          rejectedProposals.push({ id: p.id, proposalId: p.id, agentId: p.agentId, reason: 'Vetoed by security advisory review' });
        } else {
          retainedProposals.push(p);
        }
      }

      return Object.freeze({
        status: ResolutionStatus.VETOED,
        strategy,
        resolvedProposals: Object.freeze(retainedProposals),
        rejectedProposals: Object.freeze(rejectedProposals),
        conflicts: Object.freeze(conflictList),
        resolutionSummary: `Security veto exercised on targets: ${Array.from(vetoedTargets).join(', ')}. Proposals modified.`,
        ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
        requiresApproval: true
      });
    }

    // If no security agent vetoed, fallback to review required
    return Object.freeze({
      status: ResolutionStatus.REVIEW_REQUIRED,
      strategy,
      resolvedProposals: Object.freeze([]),
      rejectedProposals: Object.freeze([]),
      conflicts: Object.freeze(conflictList),
      resolutionSummary: 'No explicit security veto found; human review required.',
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // 4. HIGHEST_CONFIDENCE
  if (strategy === ConflictResolutionStrategy.HIGHEST_CONFIDENCE) {
    let bestProposal = null;
    let highestConf = -1;

    for (const p of proposalList) {
      const conf = typeof p.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0.5;
      if (conf > highestConf) {
        highestConf = conf;
        bestProposal = p;
      }
    }

    const rejected = proposalList.filter(p => p !== bestProposal).map(p => ({
      proposalId: p.id,
      agentId: p.agentId,
      reason: `Lower confidence (${p.confidence || 0.5} vs ${highestConf})`
    }));

    return Object.freeze({
      status: ResolutionStatus.RESOLVED,
      strategy,
      resolvedProposals: Object.freeze(bestProposal ? [bestProposal] : []),
      rejectedProposals: Object.freeze(rejected),
      conflicts: Object.freeze(conflictList),
      resolutionSummary: `Selected highest confidence proposal (${bestProposal ? bestProposal.id : 'none'}) at confidence ${highestConf}. Advisory only.`,
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // 5. MAJORITY
  if (strategy === ConflictResolutionStrategy.MAJORITY) {
    // Count occurrences of proposed files
    const fileVotes = new Map();
    for (const p of proposalList) {
      for (const file of p.proposedFiles || []) {
        fileVotes.set(file, (fileVotes.get(file) || 0) + 1);
      }
    }

    const majorityThreshold = Math.floor(proposalList.length / 2) + 1;
    const majorityFiles = Array.from(fileVotes.entries())
      .filter(([, votes]) => votes >= majorityThreshold)
      .map(([file]) => file);

    if (majorityFiles.length > 0) {
      return Object.freeze({
        status: ResolutionStatus.RESOLVED,
        strategy,
        resolvedProposals: Object.freeze(proposalList.filter(p => (p.proposedFiles || []).some(f => majorityFiles.includes(f)))),
        rejectedProposals: Object.freeze([]),
        conflicts: Object.freeze(conflictList),
        resolutionSummary: `Majority agreement reached on ${majorityFiles.length} file(s). Advisory only.`,
        ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
        requiresApproval: true
      });
    }

    return Object.freeze({
      status: ResolutionStatus.UNRESOLVED,
      strategy,
      resolvedProposals: Object.freeze([]),
      rejectedProposals: Object.freeze([]),
      conflicts: Object.freeze(conflictList),
      resolutionSummary: 'No clear majority achieved across conflicting proposals.',
      ...DefaultResolutionAuthorityGuarantee,
      authorityGuarantee: DefaultProposalAuthorityGuarantee,
      requiresApproval: true
    });
  }

  // Fallback
  return Object.freeze({
    status: ResolutionStatus.REVIEW_REQUIRED,
    strategy,
    resolvedProposals: Object.freeze([]),
    rejectedProposals: Object.freeze([]),
    conflicts: Object.freeze(conflictList),
    resolutionSummary: 'Unrecognized strategy; defaulting to human review required.',
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    requiresApproval: true
  });
}
