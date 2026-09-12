/**
 * AI Development OS - Controlled AI Provider Invocation Boundary
 * Phase 49 Foundation - Untrusted AI Response Normalization & FAZ 48 Proposal Validation Pipeline
 *
 * CORE INVARIANTS:
 * 1. AI OUTPUT IS UNTRUSTED INPUT: Everything returned by a provider is untrusted data.
 * 2. ZERO EXECUTION AUTHORITY: AI invocation produces proposals only.
 *    Authority guarantee: executionAuthorized=false, mutationAuthorized=false,
 *    deploymentAuthorized=false, networkAuthorized=false, shellAuthorized=false,
 *    proposalOnly=true, requiresApproval=true.
 * 3. ZERO AUTONOMOUS LOOP: Pure single-shot request-response. Zero retries, zero background workers,
 *    zero scheduling, zero self-calling, zero provider/agent chaining.
 * 4. STRICT ARCHITECTURAL PIPELINE:
 *    Task -> Routing -> Selected Agent Verification -> Provider Invocation ->
 *    Untrusted AI Response -> Normalization -> FAZ 48 Proposal Validation.
 * 5. TENANT & WORKSPACE ISOLATION: Strict matching across caller, task, agent, and provider scope.
 * 6. FAIL-CLOSED DEFENSE: Provider failure, malformed output, type confusion, prototype pollution,
 *    path traversal, or prompt injection attempts fail closed into structured rejection.
 * 7. IMMUTABILITY & DETERMINISM: All request and result artifacts are deeply frozen.
 */
import { ErrorCodes } from './constants.js';
import { AgentCapabilities } from './agent-registry.js';
import {
  ProposalOperationType,
  ProposalRiskLevel,
  createAgentProposal,
  validateAgentProposal,
  ProposalValidationResult,
  DefaultProposalAuthorityGuarantee
} from './agent-proposal.js';

export const InvocationStatus = Object.freeze({
  INVOCATION_COMPLETED: 'INVOCATION_COMPLETED',
  INVOCATION_REJECTED: 'INVOCATION_REJECTED',
  INVOCATION_FAILED: 'INVOCATION_FAILED',
  INVOCATION_INVALID: 'INVOCATION_INVALID',
  INVOCATION_UNAVAILABLE: 'INVOCATION_UNAVAILABLE'
});

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
 * Creates an immutable, validated Invocation Request.
 * Enforces authority separation (caller cannot escalate execution authority).
 */
export function createInvocationRequest({
  id,
  tenantId = null,
  workspaceId = null,
  taskId,
  agentId,
  providerId = 'local-provider',
  objective,
  requiredCapabilities = [],
  constraints = Object.freeze({}),
  metadata = Object.freeze({})
}) {
  validateRequired({ id, taskId, agentId, objective }, ['id', 'taskId', 'agentId', 'objective'], 'InvocationRequest');

  if (!isValidIdentifier(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid invocation request id: '${id}'`);
  }
  if (!isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid taskId: '${taskId}'`);
  }
  if (!isValidIdentifier(agentId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid agentId: '${agentId}'`);
  }

  if (typeof objective !== 'string' || objective.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Objective must be a non-empty string`);
  }

  // Reject prototype pollution in constraints / metadata
  if (Object.prototype.hasOwnProperty.call(constraints, '__proto__') ||
      Object.prototype.hasOwnProperty.call(metadata, '__proto__')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in invocation configuration`);
  }

  if (!Array.isArray(requiredCapabilities)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] requiredCapabilities must be an array`);
  }

  return Object.freeze({
    id: String(id).trim(),
    tenantId: tenantId ? String(tenantId).trim() : null,
    workspaceId: workspaceId ? String(workspaceId).trim() : null,
    taskId: String(taskId).trim(),
    agentId: String(agentId).trim(),
    providerId: String(providerId).trim(),
    objective: String(objective).trim(),
    requiredCapabilities: Object.freeze([...new Set(requiredCapabilities)]),
    constraints: Object.freeze({ ...constraints }),
    metadata: Object.freeze({ ...metadata }),
    authorityGuarantee: DefaultProposalAuthorityGuarantee
  });
}

/**
 * Normalizes untrusted raw provider response into a clean, safe input payload
 * for createAgentProposal. Rejects hostile execution-specific types, handles type confusion.
 */
export function normalizeUntrustedProviderResponse(rawResponse, context) {
  if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider response must be a valid non-null object`);
  }

  if (Object.prototype.hasOwnProperty.call(rawResponse, '__proto__') ||
      Object.prototype.hasOwnProperty.call(rawResponse, 'constructor')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution attempt in AI response`);
  }

  // Detect hostile chaining instructions in response
  if (rawResponse.chainToAgent || rawResponse.callProvider || rawResponse.createTask || rawResponse.nextTask) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Agent/Provider/Task chaining is strictly forbidden in proposal generation`);
  }

  // Extract text fields safely
  const rationale = typeof rawResponse.rationale === 'string'
    ? rawResponse.rationale.trim()
    : (typeof rawResponse.reason === 'string' ? rawResponse.reason.trim() : '');

  // Extract operations safely
  const rawOps = Array.isArray(rawResponse.operations) ? rawResponse.operations : [];
  const normalizedOps = [];
  for (const op of rawOps) {
    if (op && typeof op === 'object' && !Array.isArray(op)) {
      if (Object.prototype.hasOwnProperty.call(op, '__proto__')) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution in operation payload`);
      }
      // Rejection of execution operations
      const opType = typeof op.type === 'string' ? op.type.trim().toUpperCase() : (typeof op.operation === 'string' ? op.operation.trim().toUpperCase() : '');
      if (['EXECUTE_SHELL', 'RUN_COMMAND', 'DEPLOY', 'START_PROCESS', 'INSTALL_PACKAGE', 'PUSH'].includes(opType)) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Unauthorized execution-specific operation '${opType}' in AI output`);
      }
      if (Object.values(ProposalOperationType).includes(opType)) {
        normalizedOps.push({
          type: opType,
          target: typeof op.target === 'string' ? op.target.trim() : (typeof op.file === 'string' ? op.file.trim() : null),
          description: typeof op.description === 'string' ? op.description.trim() : ''
        });
      }
    }
  }

  // Extract proposedFiles safely
  const rawFiles = Array.isArray(rawResponse.proposedFiles)
    ? rawResponse.proposedFiles
    : (Array.isArray(rawResponse.files) ? rawResponse.files : []);
  const normalizedFiles = [];
  for (const f of rawFiles) {
    if (typeof f === 'string' && f.trim() !== '') {
      normalizedFiles.push(f.trim());
    }
  }

  // Extract proposedTests safely
  const rawTests = Array.isArray(rawResponse.proposedTests)
    ? rawResponse.proposedTests
    : (Array.isArray(rawResponse.tests) ? rawResponse.tests : []);
  const normalizedTests = [];
  for (const t of rawTests) {
    if (typeof t === 'string' && t.trim() !== '') {
      normalizedTests.push(t.trim());
    }
  }

  // Extract risks safely
  const rawRisks = Array.isArray(rawResponse.risks) ? rawResponse.risks : [];
  const normalizedRisks = [];
  for (const r of rawRisks) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      const level = typeof r.level === 'string' ? r.level.trim().toUpperCase() : ProposalRiskLevel.MEDIUM;
      const desc = typeof r.description === 'string' ? r.description.trim() : (typeof r.risk === 'string' ? r.risk.trim() : '');
      if (Object.values(ProposalRiskLevel).includes(level) && desc) {
        normalizedRisks.push({ level, description: desc });
      }
    }
  }

  // Extract assumptions safely
  const rawAssumptions = Array.isArray(rawResponse.assumptions) ? rawResponse.assumptions : [];
  const normalizedAssumptions = [];
  for (const a of rawAssumptions) {
    if (typeof a === 'string' && a.trim() !== '') {
      normalizedAssumptions.push(a.trim());
    }
  }

  return {
    rationale,
    operations: normalizedOps,
    proposedFiles: normalizedFiles,
    proposedTests: normalizedTests,
    risks: normalizedRisks,
    assumptions: normalizedAssumptions
  };
}

/**
 * Invokes an AI Provider through controlled boundary.
 *
 * Steps:
 * 1. Validates InvocationRequest fail-closed.
 * 2. Enforces Tenant and Workspace isolation against caller and agent.
 * 3. Verifies Agent identity, capabilities, and enabled status in AgentRegistry.
 * 4. Dispatches to provider abstraction (or mock provider) without side-effects.
 * 5. Intercepts provider response as UNTRUSTED DATA.
 * 6. Normalizes untrusted response.
 * 7. Constructs immutable FAZ 48 AgentProposal.
 * 8. Validates proposal through validateAgentProposal.
 * 9. Returns structured InvocationResult with guaranteed proposalOnly=true.
 */
export async function invokeAIProvider({
  request,
  agentRegistry,
  providerAdapter,
  callerTenantId = null,
  callerWorkspaceId = null
} = {}) {
  // 1. Validate request
  if (!request || typeof request !== 'object') {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_INVALID,
      error: 'Missing or malformed invocation request',
      code: ErrorCodes.INVALID_CONTRACT,
      proposal: null,
      validation: null
    });
  }

  // 2. Tenant Boundary Check
  const effectiveTenantId = request.tenantId || callerTenantId || null;
  if (callerTenantId !== null && request.tenantId !== null && callerTenantId !== request.tenantId) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_REJECTED,
      error: `Caller tenant '${callerTenantId}' does not match request tenant '${request.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      proposal: null,
      validation: null
    });
  }

  // Workspace Boundary Check
  const effectiveWorkspaceId = request.workspaceId || callerWorkspaceId || null;
  if (callerWorkspaceId !== null && request.workspaceId !== null && callerWorkspaceId !== request.workspaceId) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_REJECTED,
      error: `Caller workspace '${callerWorkspaceId}' does not match request workspace '${request.workspaceId}'`,
      code: ErrorCodes.SECURITY_BLOCKED,
      proposal: null,
      validation: null
    });
  }

  // 3. Agent Registry Check
  if (!agentRegistry || typeof agentRegistry.get !== 'function') {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_INVALID,
      error: 'Missing or invalid agent registry',
      code: ErrorCodes.INVALID_CONTRACT,
      proposal: null,
      validation: null
    });
  }

  let registeredAgent;
  try {
    registeredAgent = agentRegistry.get(request.agentId, {
      tenantId: effectiveTenantId,
      workspaceId: effectiveWorkspaceId
    });
  } catch (err) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_REJECTED,
      error: `Agent verification failed in registry: ${err.message}`,
      code: ErrorCodes.SECURITY_BLOCKED,
      proposal: null,
      validation: null
    });
  }

  if (registeredAgent.enabled === false) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_REJECTED,
      error: `Agent '${request.agentId}' is disabled`,
      code: ErrorCodes.SECURITY_BLOCKED,
      proposal: null,
      validation: null
    });
  }

  // Capability matching check if requiredCapabilities are declared in request
  if (Array.isArray(request.requiredCapabilities) && request.requiredCapabilities.length > 0) {
    const agentCaps = new Set(registeredAgent.capabilities || []);
    const missing = request.requiredCapabilities.filter(c => !agentCaps.has(c));
    if (missing.length > 0) {
      return Object.freeze({
        status: InvocationStatus.INVOCATION_REJECTED,
        error: `Agent '${request.agentId}' missing required capabilities: [${missing.join(', ')}]`,
        code: ErrorCodes.SECURITY_BLOCKED,
        proposal: null,
        validation: null
      });
    }
  }

  // 4. Provider Adapter Check & Invocation
  if (!providerAdapter) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_UNAVAILABLE,
      error: 'No AI provider adapter supplied',
      code: ErrorCodes.INVALID_CONTRACT,
      proposal: null,
      validation: null
    });
  }

  let rawProviderResponse;
  try {
    if (typeof providerAdapter.invoke === 'function') {
      rawProviderResponse = await providerAdapter.invoke({
        prompt: request.objective,
        agentRole: registeredAgent.role,
        constraints: request.constraints,
        metadata: {
          taskId: request.taskId,
          agentId: registeredAgent.id,
          providerId: request.providerId
        }
      });
    } else if (typeof providerAdapter.generate === 'function') {
      rawProviderResponse = await providerAdapter.generate(request.objective);
    } else if (typeof providerAdapter.analyzeAndPlan === 'function') {
      rawProviderResponse = await providerAdapter.analyzeAndPlan({
        taskPrompt: request.objective
      });
    } else {
      return Object.freeze({
        status: InvocationStatus.INVOCATION_UNAVAILABLE,
        error: 'Provider adapter does not support invocation interface',
        code: ErrorCodes.INVALID_CONTRACT,
        proposal: null,
        validation: null
      });
    }
  } catch (err) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_FAILED,
      error: `AI Provider execution failed: ${err.message}`,
      code: ErrorCodes.EXECUTION_FAILED || 'EXECUTION_FAILED',
      proposal: null,
      validation: null
    });
  }

  // 5 & 6. Normalize Untrusted Response
  let normalizedData;
  try {
    normalizedData = normalizeUntrustedProviderResponse(rawProviderResponse, { request, agent: registeredAgent });
  } catch (err) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_INVALID,
      error: `AI response normalization failed: ${err.message}`,
      code: ErrorCodes.SECURITY_BLOCKED,
      proposal: null,
      validation: null
    });
  }

  // 7. Construct FAZ 48 Agent Proposal
  let proposal;
  try {
    proposal = createAgentProposal({
      id: `prop-inv-${request.id}`,
      taskId: request.taskId,
      agentId: registeredAgent.id,
      providerId: request.providerId,
      tenantId: effectiveTenantId,
      workspaceId: effectiveWorkspaceId,
      objective: request.objective,
      rationale: normalizedData.rationale,
      operations: normalizedData.operations,
      proposedFiles: normalizedData.proposedFiles,
      proposedTests: normalizedData.proposedTests,
      risks: normalizedData.risks,
      assumptions: normalizedData.assumptions,
      constraints: request.constraints,
      metadata: {
        invocationRequestId: request.id,
        agentRole: registeredAgent.role
      }
    });
  } catch (err) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_INVALID,
      error: `Agent proposal construction failed: ${err.message}`,
      code: ErrorCodes.INVALID_CONTRACT,
      proposal: null,
      validation: null
    });
  }

  // 8. Validate Proposal through FAZ 48 Validation Gate
  const validation = validateAgentProposal(proposal, {
    expectedTenantId: effectiveTenantId,
    expectedWorkspaceId: effectiveWorkspaceId,
    expectedAgentId: registeredAgent.id,
    agentRegistry
  });

  if (!validation.valid) {
    return Object.freeze({
      status: InvocationStatus.INVOCATION_REJECTED,
      error: `Generated proposal failed validation: ${validation.reason}`,
      code: validation.code || ErrorCodes.SECURITY_BLOCKED,
      proposal,
      validation
    });
  }

  // 9. Success: return immutable result with verified authority guarantee
  return Object.freeze({
    status: InvocationStatus.INVOCATION_COMPLETED,
    invocationRequestId: request.id,
    agentId: registeredAgent.id,
    providerId: request.providerId,
    proposal,
    validation,
    authorityGuarantee: DefaultProposalAuthorityGuarantee,
    evaluatedAt: new Date().toISOString()
  });
}

