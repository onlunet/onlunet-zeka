/**
 * AI Development OS - Controlled Agent Proposal Generation Contract
 * Phase 48 Foundation - Proposal-Only / Zero Direct Execution / Untrusted Input Boundary
 *
 * CORE INVARIANTS:
 * 1. PROPOSAL IS DATA ONLY: A proposal confers zero execution, mutation, shell, network, or deployment authority.
 * 2. ZERO AUTONOMOUS LOOP: No background loops, retries, recursive agent invocations, or auto-orchestration.
 * 3. ZERO EXECUTION AUTHORITY: Default and immutable authority profile:
 *    executionAuthorized = false, mutationAuthorized = false, deploymentAuthorized = false,
 *    networkAuthorized = false, shellAuthorized = false, proposalOnly = true.
 * 4. STRICT OPERATION VOCABULARY: Only READ, ANALYZE, CREATE, MODIFY, DELETE, TEST, REVIEW, DOCUMENT.
 *    Any execution-specific operation (RUN_COMMAND, EXECUTE_SHELL, DEPLOY, etc.) is strictly rejected.
 * 5. UNTRUSTED PROVIDER & AGENT OUTPUT: All inputs are treated as untrusted; fail-closed validation.
 * 6. FILE TARGET INTEGRITY: Targets must be workspace-relative; reject path traversal, absolute paths,
 *    UNC paths, drive letters, and null bytes.
 * 7. TENANT & WORKSPACE ISOLATION: Strict matching across caller, task, agent, and proposal.
 * 8. DEEP IMMUTABILITY: All proposal objects and sub-structures are recursively frozen.
 * 9. DETERMINISTIC NORMALIZATION: Predictable, repeatable sorting and formatting without external state.
 */
import { ErrorCodes } from './constants.js';
import { AgentCapabilities } from './agent-registry.js';

export const AgentProposalStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
  INVALID: 'INVALID'
});

export const ProposalOperationType = Object.freeze({
  READ: 'READ',
  ANALYZE: 'ANALYZE',
  CREATE: 'CREATE',
  MODIFY: 'MODIFY',
  DELETE: 'DELETE',
  TEST: 'TEST',
  REVIEW: 'REVIEW',
  DOCUMENT: 'DOCUMENT'
});

export const ProposalRiskLevel = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

export const ProposalValidationResult = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  DENIED: 'DENIED'
});

export const DefaultProposalAuthorityGuarantee = Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  deploymentAuthorized: false,
  networkAuthorized: false,
  shellAuthorized: false,
  proposalOnly: true
});

const MAX_STRING_LENGTH = 10000;
const MAX_ARRAY_LENGTH = 100;

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

function isSafeString(val) {
  return typeof val === 'string' && val.length <= MAX_STRING_LENGTH && !val.includes('\0');
}

/**
 * Validates workspace-relative path target for file operations.
 * Fails closed on path traversal (..), absolute paths, drive letters, UNC paths, and null bytes.
 */
export function validateProposedFileTarget(target) {
  if (typeof target !== 'string' || target.trim() === '') {
    return { valid: false, reason: 'Target path must be a non-empty string' };
  }
  if (!isSafeString(target)) {
    return { valid: false, reason: 'Target path exceeds size limit or contains null bytes' };
  }
  const normalized = target.trim();
  if (normalized.includes('\0')) {
    return { valid: false, reason: 'Target path contains null bytes' };
  }
  if (normalized.includes('..')) {
    return { valid: false, reason: 'Target path attempts directory traversal (..)' };
  }
  if (/^[a-zA-Z]:/.test(normalized)) {
    return { valid: false, reason: 'Target path must not contain Windows drive qualifiers' };
  }
  if (normalized.startsWith('\\\\') || normalized.startsWith('//')) {
    return { valid: false, reason: 'Target path must not be a UNC path' };
  }
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return { valid: false, reason: 'Target path must be relative to workspace root' };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    return { valid: false, reason: 'Target path must not contain protocol URIs' };
  }
  // Reject shell command injection characters, command execution attempts with flags/arguments, or suspicious shell command binaries
  if (/[;&|`$<>]/ .test(normalized) || /\s+[/-]/.test(normalized) || /\b(cmd\.exe|powershell)\b/i.test(normalized)) {
    return { valid: false, reason: 'Target path contains illegal command or shell characters' };
  }
  return { valid: true, target: normalized };
}

/**
 * Normalizes and validates an individual operation.
 */
function normalizeOperation(op, index) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Operation at index ${index} must be a valid object`);
  }

  if (Object.prototype.hasOwnProperty.call(op, '__proto__')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in operation ${index}`);
  }

  const validOpTypes = Object.values(ProposalOperationType);
  if (!op.type || !validOpTypes.includes(op.type)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid operation type '${op.type}' at index ${index}. Must be one of: ${validOpTypes.join(', ')}`);
  }

  if (op.target !== undefined && op.target !== null && typeof op.target !== 'string') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Target in operation ${index} must be a string`);
  }

  let normalizedTarget = null;
  if (op.target) {
    const targetCheck = validateProposedFileTarget(op.target);
    if (!targetCheck.valid) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid target in operation ${index}: ${targetCheck.reason}`);
    }
    normalizedTarget = targetCheck.target;
  }

  if (op.description !== undefined && !isSafeString(op.description)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Operation description at index ${index} exceeds length limit or contains null bytes`);
  }

  return Object.freeze({
    type: op.type,
    target: normalizedTarget,
    description: op.description ? String(op.description).trim() : ''
  });
}

/**
 * Normalizes and validates a risk record.
 */
function normalizeRisk(risk, index) {
  if (!risk || typeof risk !== 'object' || Array.isArray(risk)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Risk at index ${index} must be a valid object`);
  }

  if (Object.prototype.hasOwnProperty.call(risk, '__proto__')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in risk ${index}`);
  }

  const validLevels = Object.values(ProposalRiskLevel);
  if (!risk.level || !validLevels.includes(risk.level)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid risk level '${risk.level}' at index ${index}. Must be one of: ${validLevels.join(', ')}`);
  }

  if (typeof risk.description !== 'string' || risk.description.trim() === '' || !isSafeString(risk.description)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Risk description at index ${index} must be a valid non-empty string`);
  }

  return Object.freeze({
    level: risk.level,
    description: String(risk.description).trim()
  });
}

/**
 * Creates an immutable, validated Controlled Agent Proposal Contract.
 */
export function createAgentProposal({
  id,
  taskId,
  agentId,
  providerId = 'local-provider',
  tenantId = null,
  workspaceId = null,
  objective,
  rationale = '',
  operations = [],
  proposedFiles = [],
  proposedTests = [],
  risks = [],
  assumptions = [],
  constraints = Object.freeze({}),
  metadata = Object.freeze({})
}) {
  validateRequired({ id, taskId, agentId, objective }, ['id', 'taskId', 'agentId', 'objective'], 'AgentProposal');

  if (!isValidIdentifier(id)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid proposal id: '${id}'`);
  }
  if (!isValidIdentifier(taskId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid taskId: '${taskId}'`);
  }
  if (!isValidIdentifier(agentId)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid agentId: '${agentId}'`);
  }

  if (!isSafeString(objective) || objective.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Objective must be a valid non-empty string`);
  }

  if (rationale && !isSafeString(rationale)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Rationale exceeds maximum string length or contains null bytes`);
  }

  // Reject prototype pollution in constraints / metadata
  if (Object.prototype.hasOwnProperty.call(constraints, '__proto__') ||
      Object.prototype.hasOwnProperty.call(metadata, '__proto__')) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in proposal configuration`);
  }

  // Arrays validation
  if (!Array.isArray(operations)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] operations must be an array`);
  }
  if (operations.length > MAX_ARRAY_LENGTH) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] operations count exceeds limit of ${MAX_ARRAY_LENGTH}`);
  }

  if (!Array.isArray(proposedFiles)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] proposedFiles must be an array`);
  }
  if (proposedFiles.length > MAX_ARRAY_LENGTH) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] proposedFiles count exceeds limit of ${MAX_ARRAY_LENGTH}`);
  }

  if (!Array.isArray(proposedTests)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] proposedTests must be an array`);
  }
  if (proposedTests.length > MAX_ARRAY_LENGTH) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] proposedTests count exceeds limit of ${MAX_ARRAY_LENGTH}`);
  }

  if (!Array.isArray(risks)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] risks must be an array`);
  }
  if (risks.length > MAX_ARRAY_LENGTH) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] risks count exceeds limit of ${MAX_ARRAY_LENGTH}`);
  }

  if (!Array.isArray(assumptions)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] assumptions must be an array`);
  }
  if (assumptions.length > MAX_ARRAY_LENGTH) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] assumptions count exceeds limit of ${MAX_ARRAY_LENGTH}`);
  }

  // Normalize operations deterministically
  const normalizedOperations = operations.map((op, idx) => normalizeOperation(op, idx));
  normalizedOperations.sort((a, b) => {
    const typeCmp = a.type.localeCompare(b.type);
    if (typeCmp !== 0) return typeCmp;
    return (a.target || '').localeCompare(b.target || '');
  });

  // Normalize proposedFiles
  const normalizedFiles = [];
  for (const f of proposedFiles) {
    const fileCheck = validateProposedFileTarget(f);
    if (!fileCheck.valid) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid proposed file '${f}': ${fileCheck.reason}`);
    }
    normalizedFiles.push(fileCheck.target);
  }
  normalizedFiles.sort();

  // Normalize proposedTests
  const normalizedTests = [];
  for (const t of proposedTests) {
    if (typeof t !== 'string' || t.trim() === '' || !isSafeString(t)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid proposed test description`);
    }
    normalizedTests.push(t.trim());
  }
  normalizedTests.sort();

  // Normalize risks deterministically
  const normalizedRisks = risks.map((r, idx) => normalizeRisk(r, idx));
  const riskRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  normalizedRisks.sort((a, b) => {
    const rankDiff = (riskRank[b.level] || 0) - (riskRank[a.level] || 0);
    if (rankDiff !== 0) return rankDiff;
    return a.description.localeCompare(b.description);
  });

  // Normalize assumptions
  const normalizedAssumptions = [];
  for (const a of assumptions) {
    if (typeof a !== 'string' || a.trim() === '' || !isSafeString(a)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid assumption string`);
    }
    normalizedAssumptions.push(a.trim());
  }
  normalizedAssumptions.sort();

  return Object.freeze({
    id: String(id).trim(),
    taskId: String(taskId).trim(),
    agentId: String(agentId).trim(),
    providerId: String(providerId).trim(),
    tenantId: tenantId ? String(tenantId).trim() : null,
    workspaceId: workspaceId ? String(workspaceId).trim() : null,
    status: AgentProposalStatus.PROPOSED,
    objective: String(objective).trim(),
    rationale: String(rationale || '').trim(),
    operations: Object.freeze(normalizedOperations),
    proposedFiles: Object.freeze([...new Set(normalizedFiles)]),
    proposedTests: Object.freeze([...new Set(normalizedTests)]),
    risks: Object.freeze(normalizedRisks),
    assumptions: Object.freeze([...new Set(normalizedAssumptions)]),
    constraints: Object.freeze({ ...constraints }),
    executionAuthorized: false,
    mutationAuthorized: false,
    deploymentAuthorized: false,
    networkAuthorized: false,
    shellAuthorized: false,
    approvalGranted: false,
    admissionGranted: false,
    verificationPassed: false,
    proposalOnly: true,
    requiresApproval: true, // Invariant: AI proposals ALWAYS require approval
    authorityGuarantee: DefaultProposalAuthorityGuarantee, // Invariant: AI proposals have ZERO execution authority
    metadata: Object.freeze({ ...metadata }),
    createdAt: new Date().toISOString()
  });
}

/**
 * Validates a proposal against agent registry, routing context, tenant boundaries, and policy constraints.
 */
export function validateAgentProposal(proposal, {
  expectedTenantId = null,
  expectedWorkspaceId = null,
  expectedAgentId = null,
  agentRegistry = null
} = {}) {
  if (!proposal || typeof proposal !== 'object') {
    return Object.freeze({
      valid: false,
      status: ProposalValidationResult.INVALID,
      reason: 'Missing or malformed proposal object',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  // Tenant Isolation Defense
  if (expectedTenantId !== null && proposal.tenantId !== null && proposal.tenantId !== expectedTenantId) {
    return Object.freeze({
      valid: false,
      status: ProposalValidationResult.DENIED,
      reason: `Tenant mismatch: expected '${expectedTenantId}', got '${proposal.tenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Workspace Isolation Defense
  if (expectedWorkspaceId !== null && proposal.workspaceId !== null && proposal.workspaceId !== expectedWorkspaceId) {
    return Object.freeze({
      valid: false,
      status: ProposalValidationResult.DENIED,
      reason: `Workspace mismatch: expected '${expectedWorkspaceId}', got '${proposal.workspaceId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Agent Identity Verification
  if (expectedAgentId !== null && proposal.agentId !== expectedAgentId) {
    return Object.freeze({
      valid: false,
      status: ProposalValidationResult.DENIED,
      reason: `Agent identity mismatch: expected '${expectedAgentId}', got '${proposal.agentId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // If agent registry is supplied, verify that the agent actually exists and is active
  if (agentRegistry && typeof agentRegistry.get === 'function') {
    try {
      const registeredAgent = agentRegistry.get(proposal.agentId, {
        tenantId: expectedTenantId || proposal.tenantId,
        workspaceId: expectedWorkspaceId || proposal.workspaceId
      });
      if (registeredAgent.enabled === false) {
        return Object.freeze({
          valid: false,
          status: ProposalValidationResult.DENIED,
          reason: `Agent '${proposal.agentId}' is disabled in registry`,
          code: ErrorCodes.SECURITY_BLOCKED
        });
      }
    } catch (err) {
      return Object.freeze({
        valid: false,
        status: ProposalValidationResult.DENIED,
        reason: `Agent registry verification failed: ${err.message}`,
        code: ErrorCodes.SECURITY_BLOCKED
      });
    }
  }

  // Authority Guarantee Verification
  const auth = proposal.authorityGuarantee;
  if (!auth || auth.executionAuthorized !== false || auth.mutationAuthorized !== false ||
      auth.deploymentAuthorized !== false || auth.networkAuthorized !== false ||
      auth.shellAuthorized !== false || auth.proposalOnly !== true) {
    return Object.freeze({
      valid: false,
      status: ProposalValidationResult.DENIED,
      reason: 'Authority guarantee violation: AI proposals cannot hold execution or mutation authority',
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  return Object.freeze({
    valid: true,
    status: ProposalValidationResult.VALID,
    proposalId: proposal.id,
    agentId: proposal.agentId,
    taskId: proposal.taskId,
    operationsCount: proposal.operations.length,
    requiresApproval: proposal.requiresApproval
  });
}

