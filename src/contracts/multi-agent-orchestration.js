/**
 * AI Development OS - Deterministic Multi-Agent Orchestration Plan Contract
 * Phase 50 Foundation - Team Composition, Topological Dependency Ordering & Proposal-Only Plan Boundary
 *
 * CORE INVARIANTS:
 * 1. ORCHESTRATION PLAN != EXECUTION PLAN: Plan defines descriptive collaboration structure only.
 * 2. ZERO EXECUTION AUTHORITY: Default & immutable authority guarantee across all members:
 *    executionAuthorized=false, mutationAuthorized=false, deploymentAuthorized=false,
 *    networkAuthorized=false, shellAuthorized=false, proposalOnly=true, requiresApproval=true.
 * 3. ZERO AUTONOMOUS LOOP: Pure deterministic planning; zero workers, zero retries, zero daemons, zero auto-chaining.
 * 4. SINGLE-AGENT FALLBACK: If a single specialist agent is sufficient, compose a 1-agent plan without unnecessary AI calls.
 * 5. BOUNDED TEAM SIZE: Strict limit (MAX_TEAM_SIZE = 5); unbounded or bloated team requests are rejected.
 * 6. DUPLICATE AGENT DEFENSE: Duplicate agent assignments within the same plan are rejected fail-closed.
 * 7. ACYCLIC DEPENDENCY GRAPH: Dependencies must be strictly directed, acyclic (DAG), and validated topologically.
 *    Self-dependencies and circular dependencies (A->B->A, A->B->C->A) are rejected.
 * 8. TENANT & WORKSPACE ISOLATION: All team members, providers, and tasks must share the same authoritative scope.
 * 9. IMMUTABILITY & DETERMINISM: Deeply frozen plan with deterministic sequence order and tie-breaking.
 */
import { ErrorCodes } from './constants.js';
import { AgentCapabilities } from './agent-registry.js';
import { DefaultProposalAuthorityGuarantee } from './agent-proposal.js';

export const MultiAgentPlanStatus = Object.freeze({
  PLANNED: 'PLANNED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_UNROUTABLE: 'PLAN_UNROUTABLE',
  PLAN_INVALID: 'PLAN_INVALID'
});

export const MAX_TEAM_SIZE = 5;

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

function isValidIdentifier(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (trimmed === '__proto__' || trimmed === 'constructor' || trimmed === 'prototype') return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(':')) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Validates that a dependency graph has no self-loops, no unknown nodes, and no cycles.
 * Returns topologically sorted array of agent IDs.
 */
export function resolveDependencyOrder(agentIds, dependencies = {}) {
  const nodeSet = new Set(agentIds);
  const inDegree = new Map();
  const adj = new Map();

  for (const id of agentIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const [id, deps] of Object.entries(dependencies)) {
    if (!nodeSet.has(id)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Dependency defined for unknown team member: '${id}'`);
    }
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        if (!nodeSet.has(dep)) {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Team member '${id}' depends on unknown member: '${dep}'`);
        }
        if (dep === id) {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Self-dependency detected for member: '${id}'`);
        }
        // Edge: dep -> id (dep must run before id)
        adj.get(dep).push(id);
        inDegree.set(id, inDegree.get(id) + 1);
      }
    }
  }

  // Kahn's algorithm with deterministic tie-breaking (lexicographical on agent.id)
  const ready = agentIds.filter(id => inDegree.get(id) === 0).sort();
  const order = [];

  while (ready.length > 0) {
    ready.sort();
    const current = ready.shift();
    order.push(current);

    for (const neighbor of adj.get(current)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        ready.push(neighbor);
      }
    }
  }

  if (order.length !== agentIds.length) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Circular dependency detected in orchestration plan graph`);
  }

  return order;
}

/**
 * Creates an immutable, validated Multi-Agent Orchestration Plan.
 */
export function createMultiAgentOrchestrationPlan({
  id,
  taskId,
  tenantId = null,
  workspaceId = null,
  objective,
  team = null,
  members = null,
  dependencies = Object.freeze({}),
  constraints = Object.freeze({}),
  metadata = Object.freeze({})
}) {
  validateRequired({ id, taskId, objective }, ['id', 'taskId', 'objective'], 'MultiAgentOrchestrationPlan');

  const actualTeam = team || members || [];

  if (!isValidIdentifier(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid orchestration plan id: '${id}'`);
  }
  if (!isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid taskId: '${taskId}'`);
  }

  if (typeof objective !== 'string' || objective.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Objective must be a non-empty string`);
  }

  // Prototype pollution rejection
  if (Object.prototype.hasOwnProperty.call(constraints, '__proto__') ||
      Object.prototype.hasOwnProperty.call(metadata, '__proto__') ||
      Object.prototype.hasOwnProperty.call(dependencies, '__proto__')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in orchestration plan configuration`);
  }

  // Team validation
  if (!Array.isArray(actualTeam)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] team must be an array`);
  }

  if (actualTeam.length === 0) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Orchestration plan requires at least one team member`);
  }

  if (actualTeam.length > MAX_TEAM_SIZE) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Team size (${actualTeam.length}) exceeds maximum limit of ${MAX_TEAM_SIZE}`);
  }

  // Check duplicate agents
  const seenAgentIds = new Set();
  for (const member of actualTeam) {
    if (!member || typeof member !== 'object' || !member.agentId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid team member definition`);
    }
    if (seenAgentIds.has(member.agentId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Duplicate agent in orchestration plan: '${member.agentId}'`);
    }
    seenAgentIds.add(member.agentId);
  }

  // Normalize dependencies to object map if array was passed: [{ agentId, dependsOn: [...] }]
  const normalizedDependencies = {};
  if (Array.isArray(dependencies)) {
    for (const d of dependencies) {
      if (d && d.agentId) {
        if (typeof d.dependsOn === 'string' && d.dependsOn.trim()) {
          normalizedDependencies[d.agentId] = [d.dependsOn.trim()];
        } else if (Array.isArray(d.dependsOn)) {
          normalizedDependencies[d.agentId] = [...d.dependsOn];
        } else {
          normalizedDependencies[d.agentId] = [];
        }
      }
    }
  } else if (dependencies && typeof dependencies === 'object') {
    Object.assign(normalizedDependencies, dependencies);
  }

  // Resolve dependency ordering and verify acyclicity
  const agentIds = Array.from(seenAgentIds);
  const executionOrder = resolveDependencyOrder(agentIds, normalizedDependencies);

  // Re-index team members according to topological sequence order
  const memberMap = new Map(actualTeam.map(m => [m.agentId, m]));
  const orderedMembers = executionOrder.map((agentId, index) => {
    const orig = memberMap.get(agentId);
    return Object.freeze({
      sequence: index + 1,
      agentId: orig.agentId,
      providerId: orig.providerId ? String(orig.providerId).trim() : 'local-provider',
      fallbackProviderId: orig.fallbackProviderId ? String(orig.fallbackProviderId).trim() : (orig.fallbackProvider ? String(orig.fallbackProvider).trim() : null),
      role: orig.role ? String(orig.role).trim() : 'Specialist',
      taskCategory: orig.taskCategory || 'general',
      capabilities: Object.freeze(Array.isArray(orig.capabilities) ? [...orig.capabilities] : []),
      dependsOn: Object.freeze(Array.isArray(normalizedDependencies[agentId]) ? [...normalizedDependencies[agentId]] : []),
      authorityGuarantee: DefaultProposalAuthorityGuarantee
    });
  });

  return Object.freeze({
    id: String(id).trim(),
    taskId: String(taskId).trim(),
    tenantId: tenantId ? String(tenantId).trim() : null,
    workspaceId: workspaceId ? String(workspaceId).trim() : null,
    status: MultiAgentPlanStatus.PLANNED,
    objective: String(objective).trim(),
    teamSize: orderedMembers.length,
    isMultiAgent: orderedMembers.length > 1,
    team: Object.freeze(orderedMembers),
    members: Object.freeze(orderedMembers),
    executionOrder: Object.freeze([...executionOrder]),
    sequence: Object.freeze([...executionOrder]),
    dependencies: Object.freeze({ ...normalizedDependencies }),
    constraints: Object.freeze({ ...constraints }),
    metadata: Object.freeze({ ...metadata }),
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    requiresApproval: true,
    createdAt: new Date().toISOString()
  });
}

/**
 * Deterministically composes a multi-agent orchestration plan for a given task definition,
 * drawing candidate specialists from the authoritative AgentRegistry.
 */
export function composeOrchestrationPlan({
  task = null,
  taskDefinition = null,
  agentRegistry,
  callerTenantId = null,
  callerWorkspaceId = null,
  maxTeamSize = MAX_TEAM_SIZE,
  requestedDependencies = []
} = {}) {
  const actualTask = task || taskDefinition;

  // Fail-closed validation
  if (!actualTask || typeof actualTask !== 'object') {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_INVALID,
      error: 'Missing or malformed task definition',
      rejectionReason: 'MISSING_TASK_DEFINITION',
      code: ErrorCodes.INVALID_CONTRACT,
      plan: null
    });
  }

  if (!agentRegistry || typeof agentRegistry.list !== 'function') {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_INVALID,
      error: 'Missing or invalid agent registry',
      rejectionReason: 'INVALID_AGENT_REGISTRY',
      code: ErrorCodes.INVALID_CONTRACT,
      plan: null
    });
  }

  // Tenant Boundary Check
  const effectiveTenantId = actualTask.tenantId || callerTenantId || null;
  if (callerTenantId !== null && actualTask.tenantId !== null && callerTenantId !== actualTask.tenantId) {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_REJECTED,
      error: `Caller tenant '${callerTenantId}' does not match task tenant '${actualTask.tenantId}'`,
      rejectionReason: 'TENANT_MISMATCH',
      code: ErrorCodes.SECURITY_BLOCKED,
      plan: null
    });
  }

  // Workspace Boundary Check
  const effectiveWorkspaceId = actualTask.workspaceId || callerWorkspaceId || null;
  if (callerWorkspaceId !== null && actualTask.workspaceId !== null && callerWorkspaceId !== actualTask.workspaceId) {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_REJECTED,
      error: `Caller workspace '${callerWorkspaceId}' does not match task workspace '${actualTask.workspaceId}'`,
      rejectionReason: 'WORKSPACE_MISMATCH',
      code: ErrorCodes.SECURITY_BLOCKED,
      plan: null
    });
  }

  // Retrieve candidate agents scoped by tenant and workspace
  const candidateAgents = agentRegistry.list({ tenantId: effectiveTenantId });
  const activeCandidates = candidateAgents.filter(a => {
    if (a.enabled === false) return false;
    if (effectiveWorkspaceId !== null && a.workspaceId !== null && a.workspaceId !== effectiveWorkspaceId) {
      return false;
    }
    return true;
  });

  if (activeCandidates.length === 0) {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_UNROUTABLE,
      error: 'No active candidate agents available in tenant/workspace scope',
      code: ErrorCodes.SECURITY_BLOCKED,
      plan: null
    });
  }

  // Determine required capabilities
  const requiredCaps = actualTask.requiredCapabilities && actualTask.requiredCapabilities.length > 0
    ? actualTask.requiredCapabilities
    : [AgentCapabilities.BACKEND_DEVELOPMENT];

  // Map each capability to the best matching active agent
  const selectedAgentsMap = new Map();
  const teamDependencies = {};

  for (const cap of requiredCaps) {
    const matching = activeCandidates.filter(a => (a.capabilities || []).includes(cap));
    if (matching.length > 0) {
      // Deterministic sort: role matching preferredRole first, then lexicographical on id
      matching.sort((a, b) => {
        if (actualTask.preferredRole) {
          const aMatch = (a.role || '').toLowerCase() === actualTask.preferredRole.toLowerCase();
          const bMatch = (b.role || '').toLowerCase() === actualTask.preferredRole.toLowerCase();
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });
      const best = matching[0];
      if (!selectedAgentsMap.has(best.id)) {
        selectedAgentsMap.set(best.id, {
          agentId: best.id,
          providerId: (best.providerConstraints && best.providerConstraints.preferredProvider) || 'local-provider',
          role: best.role,
          taskCategory: cap,
          capabilities: best.capabilities
        });
      }
    }
  }

  if (selectedAgentsMap.size === 0) {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_UNROUTABLE,
      error: `No candidate agents matched required capabilities: [${requiredCaps.join(', ')}]`,
      rejectionReason: `Missing required capabilities: [${requiredCaps.join(', ')}]`,
      code: ErrorCodes.INVALID_CONTRACT,
      plan: null
    });
  }

  // If team size exceeds limit, reject fail-closed
  const effectiveMax = Math.min(maxTeamSize, MAX_TEAM_SIZE);
  if (selectedAgentsMap.size > effectiveMax) {
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_REJECTED,
      error: `Required agents (${selectedAgentsMap.size}) exceed max allowed team size (${effectiveMax})`,
      rejectionReason: 'TEAM_SIZE_EXCEEDED',
      code: ErrorCodes.SECURITY_BLOCKED,
      plan: null
    });
  }

  const teamList = Array.from(selectedAgentsMap.values());

  // Establish standard canonical dependency ordering if multiple specialists:
  // ARCHITECTURE -> BACKEND/FRONTEND/DATABASE -> TESTING -> REVIEW/SECURITY
  const categoryRank = {
    [AgentCapabilities.ARCHITECTURE]: 1,
    [AgentCapabilities.API_DESIGN]: 2,
    [AgentCapabilities.DATABASE_DESIGN]: 2,
    [AgentCapabilities.BACKEND_DEVELOPMENT]: 3,
    [AgentCapabilities.FRONTEND_DEVELOPMENT]: 3,
    [AgentCapabilities.TESTING]: 4,
    [AgentCapabilities.DEBUGGING]: 4,
    [AgentCapabilities.SECURITY_REVIEW]: 5,
    [AgentCapabilities.CODE_REVIEW]: 5,
    [AgentCapabilities.DOCUMENTATION]: 6
  };

  // Sort team members canonically
  teamList.sort((a, b) => {
    const rankA = categoryRank[a.taskCategory] || 10;
    const rankB = categoryRank[b.taskCategory] || 10;
    if (rankA !== rankB) return rankA - rankB;
    return a.agentId.localeCompare(b.agentId);
  });

  // Assign sequential pipeline dependencies unless custom requestedDependencies provided
  if (Array.isArray(requestedDependencies) && requestedDependencies.length > 0) {
    for (const d of requestedDependencies) {
      if (d && d.agentId) {
        teamDependencies[d.agentId] = Array.isArray(d.dependsOn) ? [...d.dependsOn] : [];
      }
    }
  } else {
    for (let i = 1; i < teamList.length; i++) {
      const current = teamList[i].agentId;
      const prev = teamList[i - 1].agentId;
      teamDependencies[current] = [prev];
    }
  }

  let plan;
  try {
    plan = createMultiAgentOrchestrationPlan({
      id: `plan-orch-${actualTask.id}`,
      taskId: actualTask.id,
      tenantId: effectiveTenantId,
      workspaceId: effectiveWorkspaceId,
      objective: actualTask.objective,
      team: teamList,
      dependencies: teamDependencies,
      constraints: actualTask.constraints,
      metadata: actualTask.metadata
    });
  } catch (err) {
    const isCycle = err.message.includes('Circular dependency') || err.message.includes('CYCLIC_DEPENDENCY');
    return Object.freeze({
      status: MultiAgentPlanStatus.PLAN_INVALID,
      error: `Orchestration plan construction failed: ${err.message}`,
      rejectionReason: isCycle ? 'CYCLIC_DEPENDENCY_DETECTED' : 'CONSTRUCTION_FAILED',
      code: ErrorCodes.INVALID_CONTRACT,
      plan: null
    });
  }

  return Object.freeze({
    status: MultiAgentPlanStatus.PLANNED,
    plan,
    isMultiAgent: plan.isMultiAgent,
    teamSize: plan.teamSize
  });
}

