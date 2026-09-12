/**
 * ONLUNET ZEKA - Multi-Agent Orchestrator Execution Layer
 * FAZ 58 Foundation: Real Multi-Agent Orchestration Execution
 *
 * Implements 4 Orchestration Modes:
 * 1. SEQUENTIAL: DAG topological dependency order execution
 * 2. PARALLEL: Concurrent independent agent execution
 * 3. DEBATE_REVIEW: Specialist proposal -> Reviewer audit -> QA risk analysis
 * 4. CONSENSUS: Multi-specialist independent analysis with consensus metrics
 *
 * ZERO AUTHORITY GUARANTEE:
 * AI output is untrusted. Execution layer produces proposals only.
 * AI consensus or majority vote never confers execution authority.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { createAgentProposal, validateAgentProposal, DefaultProposalAuthorityGuarantee } from '../contracts/agent-proposal.js';
import { MultiAgentPlanStatus } from '../contracts/multi-agent-orchestration.js';

export const MAX_ORCHESTRATION_AGENTS = 10;
export const MAX_ORCHESTRATION_STEPS = 20;

export const OrchestrationExecutionMode = Object.freeze({
  SEQUENTIAL: 'SEQUENTIAL',
  PARALLEL: 'PARALLEL',
  DEBATE_REVIEW: 'DEBATE_REVIEW',
  CONSENSUS: 'CONSENSUS'
});

export const OrchestratorExecutionStatus = Object.freeze({
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  INVALID_PLAN: 'INVALID_PLAN'
});

export const DefaultOrchestratorGuarantees = Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  deploymentAuthorized: false,
  networkAuthorized: false,
  shellAuthorized: false,
  approvalGranted: false,
  admissionGranted: false,
  verificationPassed: false,
  proposalOnly: true,
  requiresApproval: true
});

function normalizeOperations(rawOps) {
  if (!Array.isArray(rawOps)) return [];
  const validOpTypes = new Set(['READ', 'ANALYZE', 'CREATE', 'MODIFY', 'DELETE', 'TEST', 'REVIEW', 'DOCUMENT']);
  return rawOps.map(op => {
    if (!op || typeof op !== 'object') return op;
    let type = typeof op.type === 'string' ? op.type.trim().toUpperCase() : 'ANALYZE';
    if (!validOpTypes.has(type)) {
      if (['WRITE', 'GENERATE', 'ADD', 'BUILD', 'INSERT', 'SETUP'].includes(type)) {
        type = 'CREATE';
      } else if (['UPDATE', 'EDIT', 'PATCH', 'FIX', 'REFACTOR'].includes(type)) {
        type = 'MODIFY';
      } else if (['REMOVE', 'DROP'].includes(type)) {
        type = 'DELETE';
      } else if (['VERIFY', 'VALIDATE', 'ASSERT'].includes(type)) {
        type = 'TEST';
      } else if (['AUDIT', 'INSPECT', 'CRITIQUE'].includes(type)) {
        type = 'REVIEW';
      } else if (['REPORT', 'SUMMARY', 'DOC', 'LOG'].includes(type)) {
        type = 'DOCUMENT';
      } else if (['FETCH', 'GET', 'LOAD'].includes(type)) {
        type = 'READ';
      } else {
        type = 'ANALYZE';
      }
    }
    const target = typeof op.target === 'string' ? op.target.trim() : (typeof op.file === 'string' ? op.file.trim() : null);
    const description = typeof op.description === 'string' ? op.description.trim() : (typeof op.summary === 'string' ? op.summary.trim() : '');
    return {
      type,
      target,
      description
    };
  });
}

function normalizeRisks(rawRisks) {
  if (!Array.isArray(rawRisks)) return [];
  const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return rawRisks.map(r => {
    if (typeof r === 'string') {
      return { level: 'LOW', description: r.trim() };
    }
    if (r && typeof r === 'object') {
      const level = typeof r.level === 'string' && validLevels.includes(r.level.toUpperCase()) ? r.level.toUpperCase() : 'LOW';
      const description = typeof r.description === 'string' ? r.description.trim() : (typeof r.risk === 'string' ? r.risk.trim() : 'General risk');
      return { level, description };
    }
    return { level: 'LOW', description: 'General risk' };
  });
}


export function createMultiAgentExecutor({
  providerGateway: rawProviderGateway,
  gateway,
  agentRegistry,
  defaultMode = OrchestrationExecutionMode.SEQUENTIAL
} = {}) {
  const providerGateway = rawProviderGateway || gateway;
  if (!providerGateway || typeof providerGateway.dispatch !== 'function') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] MultiAgentExecutor requires valid providerGateway`);
  }

  return Object.freeze({
    gateway: providerGateway,
    providerGateway,
    registry: agentRegistry,

    /**
     * Executes a multi-agent orchestration plan across registered agents & providers.
     */
    async executePlan(planOrParams = {}, maybeParams = {}) {
      let resolvedParams = planOrParams;
      if (planOrParams && (planOrParams.id || planOrParams.planId) && !planOrParams.orchestrationPlan) {
        resolvedParams = { orchestrationPlan: planOrParams, ...maybeParams };
      }

      const {
        executionId = `mae-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        orchestrationPlan,
        mode = defaultMode,
        context = {},
        tenantId = null,
        workspaceId = null,
        budgetTracker = null
      } = resolvedParams;

      if (!orchestrationPlan || typeof orchestrationPlan !== 'object') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] orchestrationPlan is required`);
      }

      if (orchestrationPlan.status && orchestrationPlan.status !== MultiAgentPlanStatus.PLANNED) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] OrchestrationPlan must be in PLANNED status, received: ${orchestrationPlan.status}`);
      }

      // 1. Tenant & Workspace isolation check (fail closed)
      if (orchestrationPlan.tenantId && (!tenantId || tenantId !== orchestrationPlan.tenantId)) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch: Caller tenant '${tenantId || 'unspecified'}' does not match plan tenant '${orchestrationPlan.tenantId}'`);
      }
      if (orchestrationPlan.workspaceId && (!workspaceId || workspaceId !== orchestrationPlan.workspaceId)) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Workspace mismatch: Caller workspace '${workspaceId || 'unspecified'}' does not match plan workspace '${orchestrationPlan.workspaceId}'`);
      }

      const effectiveTenantId = tenantId || orchestrationPlan.tenantId || null;
      const effectiveWorkspaceId = workspaceId || orchestrationPlan.workspaceId || null;

      // 2. Hard limits: max agents and duplicate agent defense
      const members = orchestrationPlan.members || orchestrationPlan.team || [];
      if (members.length > MAX_ORCHESTRATION_AGENTS) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Orchestration plan exceeds maximum agent limit of ${MAX_ORCHESTRATION_AGENTS} (received ${members.length})`);
      }

      const seenAgents = new Set();
      for (const m of members) {
        if (m && m.agentId) {
          if (seenAgents.has(m.agentId)) {
            throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Duplicate agentId '${m.agentId}' detected in orchestration plan`);
          }
          seenAgents.add(m.agentId);
        }
      }

      // 3. Execution order cycle detection and step limit
      const order = orchestrationPlan.executionOrder || members.map(m => m.agentId);
      if (order.length > MAX_ORCHESTRATION_STEPS) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Orchestration execution steps (${order.length}) exceed maximum limit of ${MAX_ORCHESTRATION_STEPS}`);
      }
      const orderSeen = new Set();
      for (const stepAgentId of order) {
        if (orderSeen.has(stepAgentId)) {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Cycle or repeated agent detected in execution order: '${stepAgentId}'`);
        }
        orderSeen.add(stepAgentId);
      }

      const activeBudget = budgetTracker || (providerGateway && providerGateway.budgetTracker);

      // Dispatch based on mode
      switch (mode) {
        case OrchestrationExecutionMode.SEQUENTIAL:
          return this._executeSequential({
            executionId,
            plan: orchestrationPlan,
            effectiveTenantId,
            effectiveWorkspaceId,
            context,
            activeBudget
          });

        case OrchestrationExecutionMode.PARALLEL:
          return this._executeParallel({
            executionId,
            plan: orchestrationPlan,
            effectiveTenantId,
            effectiveWorkspaceId,
            context,
            activeBudget
          });

        case OrchestrationExecutionMode.DEBATE_REVIEW:
          return this._executeDebateReview({
            executionId,
            plan: orchestrationPlan,
            effectiveTenantId,
            effectiveWorkspaceId,
            context,
            activeBudget
          });

        case OrchestrationExecutionMode.CONSENSUS:
          return this._executeConsensus({
            executionId,
            plan: orchestrationPlan,
            effectiveTenantId,
            effectiveWorkspaceId,
            context,
            activeBudget
          });

        default:
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unknown orchestration execution mode: '${mode}'`);
      }
    },

    /**
     * Internal: Sequential DAG topological execution
     */
    async _executeSequential({ executionId, plan, effectiveTenantId, effectiveWorkspaceId, context, activeBudget }) {
      const order = plan.executionOrder || plan.members.map(m => m.agentId);
      const memberMap = new Map(plan.members.map(m => [m.agentId, m]));

      const proposals = [];
      const traces = [];
      let cumulativeInputTokens = 0;
      let cumulativeOutputTokens = 0;
      let cumulativeCostUsd = 0;
      let previousRationale = '';

      for (const agentId of order) {
        const member = memberMap.get(agentId);
        if (!member) continue;

        // Check budget before each step
        if (activeBudget) {
          const check = activeBudget.checkBudget();
          if (!check.allowed) {
            return Object.freeze({
              executionId,
              planId: plan.id,
              taskId: plan.taskId,
              mode: OrchestrationExecutionMode.SEQUENTIAL,
              status: OrchestratorExecutionStatus.BUDGET_EXCEEDED,
              error: check.reason,
              proposals: Object.freeze(proposals),
              agentTraces: Object.freeze(traces),
              authorityGuarantee: DefaultProposalAuthorityGuarantee,
              completedAt: new Date().toISOString()
            });
          }
        }

        const agentRole = member.role || 'DEVELOPER';
        const agentPrompt = previousRationale
          ? `${plan.objective}\n\n[Previous Specialist Analysis by preceding agents]:\n${previousRationale}`
          : plan.objective;

        const dispatchResult = await providerGateway.dispatch({
          requestId: `seq-${executionId}-${agentId}`,
          providerId: member.providerId || member.preferredProvider || 'local-provider',
          fallbackProviderId: member.fallbackProviderId || member.fallbackProvider || null,
          prompt: agentPrompt,
          agentId: member.agentId,
          agentRole,
          constraints: plan.constraints,
          tenantId: effectiveTenantId,
          workspaceId: effectiveWorkspaceId,
          budgetTracker: activeBudget
        });

        traces.push({
          agentId: member.agentId,
          role: agentRole,
          providerId: dispatchResult.providerId,
          status: dispatchResult.status,
          latencyMs: dispatchResult.latencyMs || 0,
          finishReason: dispatchResult.finishReason || 'stop',
          fallbackTriggered: Boolean(dispatchResult.fallbackTriggered),
          primaryProviderId: dispatchResult.primaryProviderId || null
        });

        if (dispatchResult.usage) {
          cumulativeInputTokens += dispatchResult.usage.inputTokens || 0;
          cumulativeOutputTokens += dispatchResult.usage.outputTokens || 0;
        }
        if (dispatchResult.cost && dispatchResult.cost.estimatedCostUsd) {
          cumulativeCostUsd += dispatchResult.cost.estimatedCostUsd;
        }

        if (dispatchResult.status === 'SUCCESS') {
          previousRationale += `\n[${agentRole}]: ${dispatchResult.rationale}`;

          const proposal = createAgentProposal({
            id: `prop-${executionId}-${member.agentId}`,
            taskId: plan.taskId,
            agentId: member.agentId,
            providerId: dispatchResult.providerId,
            tenantId: effectiveTenantId,
            workspaceId: effectiveWorkspaceId,
            objective: plan.objective,
            rationale: dispatchResult.rationale,
            operations: normalizeOperations(dispatchResult.operations),
            proposedFiles: dispatchResult.proposedFiles,
            proposedTests: dispatchResult.proposedTests,
            risks: normalizeRisks(dispatchResult.risks),
            assumptions: dispatchResult.assumptions,
            metadata: {
              executionId,
              planId: plan.id,
              agentRole,
              mode: OrchestrationExecutionMode.SEQUENTIAL
            }
          });

          const activeRegistry = (agentRegistry && typeof agentRegistry.has === 'function' && agentRegistry.has(member.agentId)) ? agentRegistry : null;
          validateAgentProposal(proposal, {
            expectedTenantId: effectiveTenantId,
            expectedWorkspaceId: effectiveWorkspaceId,
            expectedAgentId: member.agentId,
            agentRegistry: activeRegistry
          });

          proposals.push(proposal);
        }
      }

      return Object.freeze({
        executionId,
        planId: plan.id,
        taskId: plan.taskId,
        mode: OrchestrationExecutionMode.SEQUENTIAL,
        status: proposals.length === order.length ? OrchestratorExecutionStatus.COMPLETED : OrchestratorExecutionStatus.PARTIAL,
        proposals: Object.freeze(proposals),
        agentTraces: Object.freeze(traces),
        usage: Object.freeze({
          inputTokens: cumulativeInputTokens,
          outputTokens: cumulativeOutputTokens,
          totalTokens: cumulativeInputTokens + cumulativeOutputTokens
        }),
        cost: Object.freeze({
          estimatedCostUsd: Number(cumulativeCostUsd.toFixed(6)),
          currency: 'USD'
        }),
        ...DefaultOrchestratorGuarantees,
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
        completedAt: new Date().toISOString()
      });
    },

    /**
     * Internal: Parallel independent agent execution
     */
    async _executeParallel({ executionId, plan, effectiveTenantId, effectiveWorkspaceId, context, activeBudget }) {
      const promises = plan.members.map(async (member) => {
        const agentRole = member.role || 'DEVELOPER';
        const dispatchResult = await providerGateway.dispatch({
          requestId: `par-${executionId}-${member.agentId}`,
          providerId: member.providerId || member.preferredProvider || 'local-provider',
          fallbackProviderId: member.fallbackProviderId || member.fallbackProvider || null,
          prompt: plan.objective,
          agentId: member.agentId,
          agentRole,
          constraints: plan.constraints,
          tenantId: effectiveTenantId,
          workspaceId: effectiveWorkspaceId,
          budgetTracker: activeBudget
        });

        const trace = {
          agentId: member.agentId,
          role: agentRole,
          providerId: dispatchResult.providerId,
          status: dispatchResult.status,
          latencyMs: dispatchResult.latencyMs || 0,
          fallbackTriggered: Boolean(dispatchResult.fallbackTriggered),
          primaryProviderId: dispatchResult.primaryProviderId || null
        };

        if (dispatchResult.status !== 'SUCCESS') {
          return { trace, proposal: null, usage: dispatchResult.usage, cost: dispatchResult.cost };
        }

        const proposal = createAgentProposal({
          id: `prop-${executionId}-${member.agentId}`,
          taskId: plan.taskId,
          agentId: member.agentId,
          providerId: dispatchResult.providerId,
          tenantId: effectiveTenantId,
          workspaceId: effectiveWorkspaceId,
          objective: plan.objective,
          rationale: dispatchResult.rationale,
          operations: normalizeOperations(dispatchResult.operations),
          proposedFiles: dispatchResult.proposedFiles,
          proposedTests: dispatchResult.proposedTests,
          risks: normalizeRisks(dispatchResult.risks),
          assumptions: dispatchResult.assumptions,
          metadata: {
            executionId,
            planId: plan.id,
            agentRole,
            mode: OrchestrationExecutionMode.PARALLEL
          }
        });

        const activeRegistry = (agentRegistry && typeof agentRegistry.has === 'function' && agentRegistry.has(member.agentId)) ? agentRegistry : null;
        validateAgentProposal(proposal, {
          expectedTenantId: effectiveTenantId,
          expectedWorkspaceId: effectiveWorkspaceId,
          expectedAgentId: member.agentId,
          agentRegistry: activeRegistry
        });

        return { trace, proposal, usage: dispatchResult.usage, cost: dispatchResult.cost };
      });

      const results = await Promise.all(promises);

      const proposals = [];
      const traces = [];
      let inT = 0;
      let outT = 0;
      let costT = 0;

      for (const res of results) {
        traces.push(res.trace);
        if (res.proposal) proposals.push(res.proposal);
        if (res.usage) {
          inT += res.usage.inputTokens || 0;
          outT += res.usage.outputTokens || 0;
        }
        if (res.cost && res.cost.estimatedCostUsd) {
          costT += res.cost.estimatedCostUsd;
        }
      }

      return Object.freeze({
        executionId,
        planId: plan.id,
        taskId: plan.taskId,
        mode: OrchestrationExecutionMode.PARALLEL,
        status: proposals.length === plan.members.length ? OrchestratorExecutionStatus.COMPLETED : OrchestratorExecutionStatus.PARTIAL,
        proposals: Object.freeze(proposals),
        agentTraces: Object.freeze(traces),
        usage: Object.freeze({
          inputTokens: inT,
          outputTokens: outT,
          totalTokens: inT + outT
        }),
        cost: Object.freeze({
          estimatedCostUsd: Number(costT.toFixed(6)),
          currency: 'USD'
        }),
        ...DefaultOrchestratorGuarantees,
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
        completedAt: new Date().toISOString()
      });
    },

    /**
     * Internal: Debate / Review mode (Proposal -> Review -> QA Audit)
     */
    async _executeDebateReview({ executionId, plan, effectiveTenantId, effectiveWorkspaceId, context, activeBudget }) {
      const primaryMember = plan.members[0] || { agentId: 'primary-dev', role: 'DEVELOPER' };
      const reviewerMember = plan.members[1] || { agentId: 'reviewer', role: 'SECURITY_ENGINEER' };
      const qaMember = plan.members[2] || { agentId: 'qa', role: 'QA_ENGINEER' };

      const traces = [];
      const proposals = [];
      let inT = 0;
      let outT = 0;
      let costT = 0;

      // 1. Primary Proposal
      const primaryRes = await providerGateway.dispatch({
        requestId: `dr-pri-${executionId}`,
        providerId: primaryMember.providerId || primaryMember.preferredProvider || 'local-provider',
        fallbackProviderId: primaryMember.fallbackProviderId || primaryMember.fallbackProvider || null,
        prompt: plan.objective,
        agentId: primaryMember.agentId,
        agentRole: primaryMember.role || 'DEVELOPER',
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        budgetTracker: activeBudget
      });
      traces.push({
        agentId: primaryMember.agentId,
        role: primaryMember.role,
        providerId: primaryRes.providerId,
        status: primaryRes.status,
        fallbackTriggered: Boolean(primaryRes.fallbackTriggered),
        primaryProviderId: primaryRes.primaryProviderId || null
      });
      if (primaryRes.usage) { inT += primaryRes.usage.inputTokens || 0; outT += primaryRes.usage.outputTokens || 0; }
      if (primaryRes.cost) costT += primaryRes.cost.estimatedCostUsd || 0;

      const primaryProp = createAgentProposal({
        id: `prop-${executionId}-${primaryMember.agentId}`,
        taskId: plan.taskId,
        agentId: primaryMember.agentId,
        providerId: primaryRes.providerId,
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        objective: plan.objective,
        rationale: primaryRes.rationale,
        operations: normalizeOperations(primaryRes.operations),
        proposedFiles: primaryRes.proposedFiles,
        proposedTests: primaryRes.proposedTests,
        risks: normalizeRisks(primaryRes.risks),
        assumptions: primaryRes.assumptions,
        metadata: { executionId, role: primaryMember.role, stage: 'PRIMARY_PROPOSAL' }
      });
      proposals.push(primaryProp);

      // 2. Reviewer Critique
      const reviewPrompt = `Audit and critique the following proposal for task: ${plan.objective}\n\n[Proposed Changes]:\n${JSON.stringify(primaryRes.operations, null, 2)}\n\nRationale: ${primaryRes.rationale}`;
      const reviewRes = await providerGateway.dispatch({
        requestId: `dr-rev-${executionId}`,
        providerId: reviewerMember.providerId || reviewerMember.preferredProvider || 'local-provider',
        fallbackProviderId: reviewerMember.fallbackProviderId || reviewerMember.fallbackProvider || null,
        prompt: reviewPrompt,
        agentId: reviewerMember.agentId,
        agentRole: reviewerMember.role || 'SECURITY_ENGINEER',
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        budgetTracker: activeBudget
      });
      traces.push({
        agentId: reviewerMember.agentId,
        role: reviewerMember.role,
        providerId: reviewRes.providerId,
        status: reviewRes.status,
        fallbackTriggered: Boolean(reviewRes.fallbackTriggered),
        primaryProviderId: reviewRes.primaryProviderId || null
      });
      if (reviewRes.usage) { inT += reviewRes.usage.inputTokens || 0; outT += reviewRes.usage.outputTokens || 0; }
      if (reviewRes.cost) costT += reviewRes.cost.estimatedCostUsd || 0;

      const reviewProp = createAgentProposal({
        id: `prop-${executionId}-${reviewerMember.agentId}`,
        taskId: plan.taskId,
        agentId: reviewerMember.agentId,
        providerId: reviewRes.providerId,
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        objective: plan.objective,
        rationale: reviewRes.rationale,
        operations: normalizeOperations(reviewRes.operations && reviewRes.operations.length > 0 ? reviewRes.operations : primaryRes.operations),
        proposedFiles: reviewRes.proposedFiles && reviewRes.proposedFiles.length > 0 ? reviewRes.proposedFiles : primaryRes.proposedFiles,
        proposedTests: reviewRes.proposedTests,
        risks: normalizeRisks([...(primaryRes.risks || []), ...(reviewRes.risks || [])]),
        assumptions: reviewRes.assumptions,
        metadata: { executionId, role: reviewerMember.role, stage: 'REVIEW_AUDIT' }
      });
      proposals.push(reviewProp);

      // 3. QA Assessment if 3rd member exists
      if (plan.members.length >= 3) {
        const qaPrompt = `Formulate comprehensive test cases and verification steps for objective: ${plan.objective}\n\nExisting files: ${primaryRes.proposedFiles.join(', ')}`;
        const qaRes = await providerGateway.dispatch({
          requestId: `dr-qa-${executionId}`,
          providerId: qaMember.providerId || qaMember.preferredProvider || 'local-provider',
          fallbackProviderId: qaMember.fallbackProviderId || qaMember.fallbackProvider || null,
          prompt: qaPrompt,
          agentId: qaMember.agentId,
          agentRole: qaMember.role || 'QA_ENGINEER',
          tenantId: effectiveTenantId,
          workspaceId: effectiveWorkspaceId,
          budgetTracker: activeBudget
        });
        traces.push({
          agentId: qaMember.agentId,
          role: qaMember.role,
          providerId: qaRes.providerId,
          status: qaRes.status,
          fallbackTriggered: Boolean(qaRes.fallbackTriggered),
          primaryProviderId: qaRes.primaryProviderId || null
        });
        if (qaRes.usage) { inT += qaRes.usage.inputTokens || 0; outT += qaRes.usage.outputTokens || 0; }
        if (qaRes.cost) costT += qaRes.cost.estimatedCostUsd || 0;

        const qaProp = createAgentProposal({
          id: `prop-${executionId}-${qaMember.agentId}`,
          taskId: plan.taskId,
          agentId: qaMember.agentId,
          providerId: qaRes.providerId,
          tenantId: effectiveTenantId,
          workspaceId: effectiveWorkspaceId,
          objective: plan.objective,
          rationale: qaRes.rationale,
          operations: normalizeOperations(qaRes.operations),
          proposedFiles: qaRes.proposedFiles,
          proposedTests: qaRes.proposedTests.length > 0 ? qaRes.proposedTests : [`tests/${plan.taskId}.test.js`],
          risks: normalizeRisks(qaRes.risks),
          assumptions: qaRes.assumptions,
          metadata: { executionId, role: qaMember.role, stage: 'QA_VERIFICATION' }
        });
        proposals.push(qaProp);
      }

      return Object.freeze({
        executionId,
        planId: plan.id,
        taskId: plan.taskId,
        mode: OrchestrationExecutionMode.DEBATE_REVIEW,
        status: OrchestratorExecutionStatus.COMPLETED,
        proposals: Object.freeze(proposals),
        agentTraces: Object.freeze(traces),
        usage: Object.freeze({ inputTokens: inT, outputTokens: outT, totalTokens: inT + outT }),
        cost: Object.freeze({ estimatedCostUsd: Number(costT.toFixed(6)), currency: 'USD' }),
        ...DefaultOrchestratorGuarantees,
        authorityGuarantee: DefaultProposalAuthorityGuarantee,
        completedAt: new Date().toISOString()
      });
    },

    /**
     * Internal: Consensus mode (Multi-specialist independent analysis + consensus metrics)
     */
    async _executeConsensus({ executionId, plan, effectiveTenantId, effectiveWorkspaceId, context, activeBudget }) {
      const parallelRun = await this._executeParallel({
        executionId,
        plan,
        effectiveTenantId,
        effectiveWorkspaceId,
        context,
        activeBudget
      });

      const proposals = parallelRun.proposals || [];

      // Calculate consensus metrics algorithmically without AI authority
      const fileVotes = new Map();
      const opTypeVotes = new Map();

      for (const p of proposals) {
        for (const file of p.proposedFiles) {
          fileVotes.set(file, (fileVotes.get(file) || 0) + 1);
        }
        for (const op of p.operations) {
          opTypeVotes.set(op.type, (opTypeVotes.get(op.type) || 0) + 1);
        }
      }

      const consensusSummary = {
        totalAgents: plan.members.length,
        proposalsReceived: proposals.length,
        sharedFiles: Array.from(fileVotes.entries()).filter(([_, count]) => count > 1).map(([file]) => file),
        divergentFiles: Array.from(fileVotes.entries()).filter(([_, count]) => count === 1).map(([file]) => file),
        // Crucial security invariant: Consensus is informational only, zero execution authority
        consensusAuthorityGranted: false
      };

      return Object.freeze({
        ...parallelRun,
        mode: OrchestrationExecutionMode.CONSENSUS,
        consensusSummary: Object.freeze(consensusSummary),
        authorityGuarantee: DefaultProposalAuthorityGuarantee
      });
    }
  });
}

export const createMultiAgentOrchestrator = createMultiAgentExecutor;
