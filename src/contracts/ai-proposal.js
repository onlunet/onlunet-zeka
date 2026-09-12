/**
 * AI Development OS - Declarative AI Provider & Proposal Abstraction Boundary
 * Phase 45 Foundation - Proposal-Only / Zero Direct Execution / Untrusted External Input Boundary
 *
 * CORE INVARIANTS:
 * 1. AI HAS NO EXECUTION AUTHORITY (AI -> PROPOSAL ONLY).
 * 2. AI HAS NO ADMISSION AUTHORITY (Cannot admit, approve, or authorize its own proposals).
 * 3. AI HAS NO POLICY AUTHORITY (Cannot create, mutate, or override policies).
 * 4. PROVIDER IS UNTRUSTED (Every response is untrusted data).
 * 5. NO DIRECT TOOL EXECUTION (No shell, no fs, no spawn, no git, no network dispatch).
 * 6. ZERO AUTONOMOUS / RETRY LOOPS / ZERO WORKERS / ZERO SCHEDULERS.
 * 7. FAIL-CLOSED VALIDATION.
 */
import { ErrorCodes } from './constants.js';

export const AIProposalStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED'
});

export const AIProposedOperationType = Object.freeze({
  EXECUTE_COMMAND: 'EXECUTE_COMMAND',
  MUTATE_FILE: 'MUTATE_FILE'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates an immutable, normalized AI Provider Contract descriptor.
 * Exposes identity, capabilities, and normalization without any execution primitives.
 */
export function createAIProviderContract({
  providerId,
  modelId,
  name,
  apiVersion = '2026-v1',
  supportedCapabilities = Object.freeze(['PROPOSAL_GENERATION']),
  metadata = Object.freeze({})
}) {
  validateRequired({ providerId, modelId, name }, ['providerId', 'modelId', 'name'], 'AIProviderContract');

  return Object.freeze({
    providerId: String(providerId).trim(),
    modelId: String(modelId).trim(),
    name: String(name).trim(),
    apiVersion: String(apiVersion).trim(),
    supportedCapabilities: Object.freeze([...supportedCapabilities]),
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Normalizes raw, untrusted provider responses into an immutable, structured AI Proposal.
 * Ensures untrusted AI data is captured declaratively without execution side-effects.
 */
export function normalizeAIProposal({
  id,
  providerContract,
  tenantId,
  workspaceRoot,
  jobId = null,
  taskId = null,
  planId = null,
  rawResponse,
  timestamp = new Date().toISOString()
}) {
  validateRequired({ id, providerContract, tenantId, workspaceRoot }, ['id', 'providerContract', 'tenantId', 'workspaceRoot'], 'normalizeAIProposal');

  if (!providerContract || typeof providerContract !== 'object' || !providerContract.providerId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid providerContract`);
  }

  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] rawResponse must be a non-null object`);
  }

  // Extract declarative proposal details from untrusted provider response
  const rawIntent = typeof rawResponse.intent === 'string' ? rawResponse.intent.trim() : (typeof rawResponse.task === 'string' ? rawResponse.task.trim() : 'AI Generated Proposal');
  const rawAnalysis = typeof rawResponse.analysis === 'string' ? rawResponse.analysis.trim() : '';

  // Parse proposed operations declaratively
  const rawOps = Array.isArray(rawResponse.operations) ? rawResponse.operations : [];
  const proposedOperations = [];

  for (const op of rawOps) {
    if (op && typeof op === 'object' && typeof op.type === 'string') {
      if (op.type === AIProposedOperationType.EXECUTE_COMMAND) {
        proposedOperations.push(Object.freeze({
          type: AIProposedOperationType.EXECUTE_COMMAND,
          command: typeof op.command === 'string' ? op.command.trim() : '',
          rationale: typeof op.rationale === 'string' ? op.rationale.trim() : ''
        }));
      } else if (op.type === AIProposedOperationType.MUTATE_FILE) {
        proposedOperations.push(Object.freeze({
          type: AIProposedOperationType.MUTATE_FILE,
          targetPath: typeof op.targetPath === 'string' ? op.targetPath.trim() : '',
          operation: typeof op.operation === 'string' ? op.operation.trim() : 'WRITE',
          content: typeof op.content === 'string' ? op.content : '',
          rationale: typeof op.rationale === 'string' ? op.rationale.trim() : ''
        }));
      }
    }
  }

  // Also support legacy proposedCommands and proposedFileChanges for interoperability
  if (Array.isArray(rawResponse.proposedCommands)) {
    for (const cmd of rawResponse.proposedCommands) {
      if (typeof cmd === 'string' && cmd.trim() !== '') {
        proposedOperations.push(Object.freeze({
          type: AIProposedOperationType.EXECUTE_COMMAND,
          command: cmd.trim(),
          rationale: 'Normalized from proposedCommands'
        }));
      }
    }
  }

  if (Array.isArray(rawResponse.proposedFileMutations)) {
    for (const mut of rawResponse.proposedFileMutations) {
      if (mut && typeof mut === 'object' && typeof mut.file === 'string') {
        proposedOperations.push(Object.freeze({
          type: AIProposedOperationType.MUTATE_FILE,
          targetPath: mut.file.trim(),
          operation: 'WRITE',
          content: typeof mut.content === 'string' ? mut.content : '',
          rationale: 'Normalized from proposedFileMutations'
        }));
      }
    }
  }

  return Object.freeze({
    id: String(id).trim(),
    provider: Object.freeze({
      providerId: providerContract.providerId,
      modelId: providerContract.modelId,
      apiVersion: providerContract.apiVersion
    }),
    tenantId: String(tenantId).trim(),
    workspaceRoot: String(workspaceRoot).trim(),
    jobId: jobId ? String(jobId).trim() : null,
    taskId: taskId ? String(taskId).trim() : null,
    planId: planId ? String(planId).trim() : null,
    intent: rawIntent,
    analysis: rawAnalysis,
    proposedOperations: Object.freeze(proposedOperations),
    provenance: Object.freeze({
      generatedBy: 'AI_PROVIDER_NORMALIZATION',
      sourceType: 'EXTERNAL_UNTRUSTED_AI',
      timestamp
    }),
    status: AIProposalStatus.PROPOSED
  });
}

/**
 * Deterministically validates an AI Proposal against tenant, workspace, and structural integrity rules.
 *
 * Rules:
 * 1. Missing or malformed inputs -> REJECT.
 * 2. Type confusion -> REJECT.
 * 3. Insecure path traversal or workspace escape -> REJECT.
 * 4. Fake claims of approval or authority in payload -> Ignored and rejected.
 * 5. Deterministic outcome: VALIDATED or REJECTED.
 * 6. ZERO EXECUTION: This function evaluates data contracts only.
 */
export function validateAIProposal(proposal, { expectedTenantId = null, expectedWorkspaceRoot = null } = {}) {
  if (!proposal || typeof proposal !== 'object') {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: 'Missing or malformed proposal object',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (proposal.status !== AIProposalStatus.PROPOSED) {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: `Proposal is in invalid status: ${proposal.status}`,
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  if (!proposal.id || !proposal.tenantId || !proposal.workspaceRoot || !proposal.provider) {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: 'Proposal missing required identity fields',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  // Tenant matching
  if (expectedTenantId !== null && proposal.tenantId !== expectedTenantId) {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: `Tenant mismatch: proposal tenantId '${proposal.tenantId}' does not match expected '${expectedTenantId}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Workspace matching
  if (expectedWorkspaceRoot !== null && proposal.workspaceRoot !== expectedWorkspaceRoot) {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: `Workspace mismatch: proposal workspaceRoot '${proposal.workspaceRoot}' does not match expected '${expectedWorkspaceRoot}'`,
      code: ErrorCodes.SECURITY_BLOCKED
    });
  }

  // Validate proposed operations for structural safety and path traversal
  if (!Array.isArray(proposal.proposedOperations)) {
    return Object.freeze({
      valid: false,
      status: AIProposalStatus.REJECTED,
      reason: 'proposedOperations must be an array',
      code: ErrorCodes.INVALID_CONTRACT
    });
  }

  for (const op of proposal.proposedOperations) {
    if (!op || typeof op !== 'object') {
      return Object.freeze({
        valid: false,
        status: AIProposalStatus.REJECTED,
        reason: 'Malformed operation object in proposedOperations',
        code: ErrorCodes.INVALID_CONTRACT
      });
    }

    if (!Object.values(AIProposedOperationType).includes(op.type)) {
      return Object.freeze({
        valid: false,
        status: AIProposalStatus.REJECTED,
        reason: `Unknown proposed operation type: ${op.type}`,
        code: ErrorCodes.SECURITY_BLOCKED
      });
    }

    if (op.type === AIProposedOperationType.MUTATE_FILE) {
      if (!op.targetPath || typeof op.targetPath !== 'string') {
        return Object.freeze({
          valid: false,
          status: AIProposalStatus.REJECTED,
          reason: 'Mutation operation missing targetPath',
          code: ErrorCodes.INVALID_CONTRACT
        });
      }

      // Check path traversal in proposal
      const norm = op.targetPath.replace(/\\/g, '/');
      if (norm.includes('../') || norm.includes('/..') || norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) {
        return Object.freeze({
          valid: false,
          status: AIProposalStatus.REJECTED,
          reason: `Mutation targetPath '${op.targetPath}' contains illegal path traversal or absolute path`,
          code: ErrorCodes.SECURITY_BLOCKED
        });
      }
    }

    if (op.type === AIProposedOperationType.EXECUTE_COMMAND) {
      if (!op.command || typeof op.command !== 'string' || op.command.trim() === '') {
        return Object.freeze({
          valid: false,
          status: AIProposalStatus.REJECTED,
          reason: 'Command operation missing non-empty command',
          code: ErrorCodes.INVALID_CONTRACT
        });
      }
    }
  }

  return Object.freeze({
    valid: true,
    status: AIProposalStatus.VALIDATED,
    proposalId: proposal.id,
    reason: 'Proposal structurally validated against declarative contract'
  });
}
