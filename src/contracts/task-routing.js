/**
 * AI Development OS - Task Routing & Controlled Agent Orchestration Contract
 * Phase 47 Foundation - Deterministic Task Normalization, Classification & Agent Candidate Selection
 *
 * CORE INVARIANTS:
 * 1. ZERO AUTONOMOUS LOOP: No self-invoking, recursive, or looping routing.
 * 2. ZERO NEW EXECUTION AUTHORITY: Routing selects specialist agents for proposal generation ONLY.
 * 3. ROUTING DECISION != EXECUTION: Decision confers zero shell, mutation, or deployment authority.
 * 4. DETERMINISTIC MATCHING: Scoring, capability overlap, and tie-breaking are fully deterministic.
 * 5. FAIL-CLOSED BOUNDARIES: Unknown capabilities, missing registry, or policy rejections fail-closed.
 * 6. TENANT & WORKSPACE ISOLATION: Cross-tenant/workspace routing is strictly denied.
 * 7. IMMUTABILITY: All inputs and outputs are deeply frozen.
 */
import { ErrorCodes } from './constants.js';
import { AgentCapabilities } from './agent-registry.js';
import { AutonomousPolicyDecision } from './autonomous-policy.js';

export const TaskRoutingStatus = Object.freeze({
  ROUTED: 'ROUTED',
  ROUTING_DENIED: 'ROUTING_DENIED',
  UNROUTABLE: 'UNROUTABLE'
});

export const TaskCategory = Object.freeze({
  ARCHITECTURE: 'architecture',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DATABASE: 'database',
  TESTING: 'testing',
  SECURITY: 'security',
  CODE_REVIEW: 'code_review',
  DOCUMENTATION: 'documentation',
  RESEARCH: 'research',
  DEBUGGING: 'debugging',
  GENERAL: 'general'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

function isValidTaskId(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (trimmed === '__proto__' || trimmed === 'constructor' || trimmed === 'prototype') return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(':')) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Creates an immutable, validated Task Definition for routing.
 */
export function createTaskDefinition({
  id,
  objective,
  tenantId = null,
  workspaceId = null,
  requiredCapabilities = [],
  preferredRole = null,
  constraints = Object.freeze({}),
  metadata = Object.freeze({})
}) {
  validateRequired({ id, objective }, ['id', 'objective'], 'TaskDefinition');

  if (!isValidTaskId(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid task id: '${id}'. Must be alphanumeric with '-' or '_', without path traversal.`);
  }

  if (typeof objective !== 'string' || objective.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task objective must be a non-empty string`);
  }

  if (!Array.isArray(requiredCapabilities)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] requiredCapabilities must be an array`);
  }

  const validCaps = Object.values(AgentCapabilities);
  for (const cap of requiredCapabilities) {
    if (!validCaps.includes(cap)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unknown required capability: '${cap}'`);
    }
  }

  return Object.freeze({
    id: String(id).trim(),
    objective: String(objective).trim(),
    tenantId: tenantId ? String(tenantId).trim() : null,
    workspaceId: workspaceId ? String(workspaceId).trim() : null,
    requiredCapabilities: Object.freeze([...new Set(requiredCapabilities)]),
    preferredRole: preferredRole ? String(preferredRole).trim() : null,
    constraints: Object.freeze({ ...constraints }),
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Deterministically classifies a task objective into a category and infers capabilities if none are specified.
 */
export function classifyTaskObjective(objective) {
  if (!objective || typeof objective !== 'string') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Objective must be a valid non-empty string`);
  }

  const lower = objective.toLowerCase();

  if (/\b(architecture|architect|design pattern|system design|high-level|structure|modular|boundaries)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.ARCHITECTURE,
      inferredCapabilities: Object.freeze([AgentCapabilities.ARCHITECTURE, AgentCapabilities.API_DESIGN])
    });
  }

  if (/\b(security|vulnerability|audit|injection|xss|sanitize|adversarial|cve|auth|authorization)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.SECURITY,
      inferredCapabilities: Object.freeze([AgentCapabilities.SECURITY_REVIEW, AgentCapabilities.CODE_REVIEW])
    });
  }

  if (/\b(test|tests|testing|coverage|unit test|integration test|e2e|qa|spec)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.TESTING,
      inferredCapabilities: Object.freeze([AgentCapabilities.TESTING, AgentCapabilities.DEBUGGING])
    });
  }

  if (/\b(review|code review|inspect|pull request|diff review|lint)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.CODE_REVIEW,
      inferredCapabilities: Object.freeze([AgentCapabilities.CODE_REVIEW])
    });
  }

  if (/\b(database|sql|migration|schema|postgres|sqlite|query|table|indexing)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.DATABASE,
      inferredCapabilities: Object.freeze([AgentCapabilities.DATABASE_DESIGN, AgentCapabilities.BACKEND_DEVELOPMENT])
    });
  }

  if (/\b(frontend|ui|ux|component|react|vue|html|css|styling|client|browser)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.FRONTEND,
      inferredCapabilities: Object.freeze([AgentCapabilities.FRONTEND_DEVELOPMENT])
    });
  }

  if (/\b(api|backend|endpoint|service|server|controller|route|http|middleware)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.BACKEND,
      inferredCapabilities: Object.freeze([AgentCapabilities.BACKEND_DEVELOPMENT, AgentCapabilities.API_DESIGN])
    });
  }

  if (/\b(doc|docs|documentation|readme|specification|manual|guide)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.DOCUMENTATION,
      inferredCapabilities: Object.freeze([AgentCapabilities.DOCUMENTATION])
    });
  }

  if (/\b(debug|bug|fix|error|exception|crash|trace|stacktrace)\b/.test(lower)) {
    return Object.freeze({
      category: TaskCategory.DEBUGGING,
      inferredCapabilities: Object.freeze([AgentCapabilities.DEBUGGING])
    });
  }

  return Object.freeze({
    category: TaskCategory.GENERAL,
    inferredCapabilities: Object.freeze([AgentCapabilities.BACKEND_DEVELOPMENT])
  });
}

function scoreCandidateAgent(agent, task, resolvedCapabilities) {
  let score = 0;
  const agentCaps = new Set(agent.capabilities);
  let matchedCaps = 0;

  for (const reqCap of resolvedCapabilities) {
    if (agentCaps.has(reqCap)) {
      matchedCaps++;
      score += 10;
    }
  }

  const capabilityCoverage = resolvedCapabilities.length > 0 ? (matchedCaps / resolvedCapabilities.length) : 1;
  score = score * capabilityCoverage;

  if (task.preferredRole && agent.role && agent.role.toLowerCase() === task.preferredRole.toLowerCase()) {
    score += 5;
  }

  if (task.constraints && task.constraints.preferredProvider && agent.providerConstraints && agent.providerConstraints.preferredProvider) {
    if (task.constraints.preferredProvider === agent.providerConstraints.preferredProvider) {
      score += 2;
    }
  }

  return {
    agentId: agent.id,
    score,
    matchedCapabilities: matchedCaps,
    totalRequiredCapabilities: resolvedCapabilities.length,
    fullyMatches: matchedCaps === resolvedCapabilities.length
  };
}

export function routeTask({
  task,
  agentRegistry,
  callerTenantId = null,
  callerWorkspaceId = null,
  autonomousPolicy = null,
  policyEvaluator = null
} = {}) {
  if (!task || typeof task !== 'object') {
    return Object.freeze({
      status: TaskRoutingStatus.UNROUTABLE,
      selectedAgentId: null,
      selectedAgent: null,
      reason: 'Missing or malformed task definition',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (!agentRegistry || typeof agentRegistry.list !== 'function') {
    return Object.freeze({
      status: TaskRoutingStatus.UNROUTABLE,
      selectedAgentId: null,
      selectedAgent: null,
      reason: 'Missing or invalid agent registry',
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (Object.prototype.hasOwnProperty.call(task, '__proto__') ||
      (task.constraints && Object.prototype.hasOwnProperty.call(task.constraints, '__proto__'))) {
    return Object.freeze({
      status: TaskRoutingStatus.ROUTING_DENIED,
      selectedAgentId: null,
      selectedAgent: null,
      reason: 'Prototype pollution attempt detected in task',
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (callerTenantId !== null && task.tenantId !== null && callerTenantId !== task.tenantId) {
    return Object.freeze({
      status: TaskRoutingStatus.ROUTING_DENIED,
      selectedAgentId: null,
      selectedAgent: null,
      reason: `Caller tenant '${callerTenantId}' does not match task tenant '${task.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  if (callerWorkspaceId !== null && task.workspaceId !== null && callerWorkspaceId !== task.workspaceId) {
    return Object.freeze({
      status: TaskRoutingStatus.ROUTING_DENIED,
      selectedAgentId: null,
      selectedAgent: null,
      reason: `Caller workspace '${callerWorkspaceId}' does not match task workspace '${task.workspaceId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  const effectiveTenantId = task.tenantId || callerTenantId || null;
  const effectiveWorkspaceId = task.workspaceId || callerWorkspaceId || null;

  let resolvedCapabilities = task.requiredCapabilities || [];
  let classification = null;
  if (!resolvedCapabilities || resolvedCapabilities.length === 0) {
    classification = classifyTaskObjective(task.objective);
    resolvedCapabilities = classification.inferredCapabilities;
  }

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
      status: TaskRoutingStatus.UNROUTABLE,
      selectedAgentId: null,
      selectedAgent: null,
      reason: 'No active candidate agents available in tenant/workspace scope',
      code: ErrorCodes.SECURITY_BLOCKED,
      evaluatedAt: new Date().toISOString()
    });
  }

  const scored = [];
  for (const agent of activeCandidates) {
    const candidateScore = scoreCandidateAgent(agent, task, resolvedCapabilities);
    if (candidateScore.matchedCapabilities > 0) {
      scored.push({
        agent,
        ...candidateScore
      });
    }
  }

  if (scored.length === 0) {
    return Object.freeze({
      status: TaskRoutingStatus.UNROUTABLE,
      selectedAgentId: null,
      selectedAgent: null,
      reason: `No candidate agents matched required capabilities: [${resolvedCapabilities.join(', ')}]`,
      code: ErrorCodes.INVALID_CONTRACT,
      evaluatedAt: new Date().toISOString()
    });
  }

  scored.sort((a, b) => {
    if (a.fullyMatches !== b.fullyMatches) {
      return a.fullyMatches ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.matchedCapabilities !== a.matchedCapabilities) {
      return b.matchedCapabilities - a.matchedCapabilities;
    }
    return a.agent.id.localeCompare(b.agent.id);
  });

  const topCandidate = scored[0];

  if (autonomousPolicy && policyEvaluator) {
    const syntheticWorkUnit = {
      id: `route-eval-${task.id}`,
      tenantId: effectiveTenantId,
      workspaceRoot: effectiveWorkspaceId,
      action: {
        type: 'ROUTING_PROPOSAL',
        agentId: topCandidate.agent.id,
        objective: task.objective
      }
    };

    const policyDecision = policyEvaluator({
      policy: autonomousPolicy,
      workUnit: syntheticWorkUnit
    });

    if (policyDecision && policyDecision.decision === AutonomousPolicyDecision.REJECT) {
      return Object.freeze({
        status: TaskRoutingStatus.ROUTING_DENIED,
        selectedAgentId: null,
        selectedAgent: null,
        reason: `Autonomous Policy denied routing: ${policyDecision.reason}`,
        code: policyDecision.code || ErrorCodes.SECURITY_BLOCKED,
        evaluatedAt: new Date().toISOString()
      });
    }
  }

  return Object.freeze({
    status: TaskRoutingStatus.ROUTED,
    taskId: task.id,
    selectedAgentId: topCandidate.agent.id,
    selectedAgent: topCandidate.agent,
    category: classification ? classification.category : TaskCategory.GENERAL,
    resolvedCapabilities: Object.freeze([...resolvedCapabilities]),
    matchScore: topCandidate.score,
    fullyMatches: topCandidate.fullyMatches,
    authorityGuarantee: Object.freeze({
      executionAuthorized: false,
      mutationAuthorized: false,
      proposalOnly: true
    }),
    evaluatedAt: new Date().toISOString()
  });
}
