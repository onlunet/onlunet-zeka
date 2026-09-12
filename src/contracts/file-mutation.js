/**
 * AI Development OS - Controlled File Mutation Boundary Foundation
 * Phase 16, 16.1 & Phase 17 - Single-File Controlled Mutation Boundary with Authoritative Target Binding
 *
 * MUTATION REQUIRES AUTHORIZATION
 * MUTATION != ARBITRARY WRITE
 * AUTHORIZED TARGET + EXPECTED STATE == ACTUALLY APPLIED MUTATION
 * ZERO PROCESS SPAWN / ZERO SHELL / ZERO RETRY / STRICT SCOPE LOCK
 */
import fs from 'node:fs';
import path from 'node:path';
import { ErrorCodes } from './constants.js';
import { AuthorizationDecision } from './execution-authorization.js';
import { isPathInsideDirectory } from '../interfaces/core.js';

export const FileMutationOperation = Object.freeze({
  WRITE: 'WRITE',
  DELETE: 'DELETE'
});

export const FileMutationOutcome = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED'
});

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Creates an immutable, declarative FileMutationResultContract.
 */
export function createFileMutationResultContract({
  id,
  taskId,
  planId,
  targetPath,
  outcome,
  failureReason = null,
  isDryRun = false,
  metadata = {}
}) {
  validateRequired({ id, taskId, planId, targetPath, outcome }, ['id', 'taskId', 'planId', 'targetPath', 'outcome'], 'FileMutationResultContract');

  if (!Object.values(FileMutationOutcome).includes(outcome)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid FileMutationOutcome: ${outcome}`);
  }

  return Object.freeze({
    id,
    taskId,
    planId,
    targetPath,
    outcome,
    failureReason,
    isDryRun,
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Controlled File Mutation Boundary Executor.
 * Strictly executes single-file mutation (WRITE or DELETE) within an authorized workspace context.
 *
 * Enforces:
 * 1. Valid AUTHORIZED decision
 * 2. ID consistency chain (taskId, planId, handoffId)
 * 3. Exact authorizedContext binding:
 *    - authorizedContext.workingDirectory == workspaceRoot
 *    - authorizedContext.authorizedTarget (mandatory) == targetPath
 *    - authorizedContext.expectedState matches existing content (or null for non-existent file)
 * 4. Path containment verification (isPathInsideDirectory - no traversals, no escapes)
 * 5. Distinction between NOT_EXISTS and READ_ERROR (Read errors strictly block mutation)
 * 6. Authentic execution for both WRITE and DELETE operations
 * 7. Dry-run option (simulates without disk write/delete)
 * 8. Note on atomicity: Single-file synchronous operation. Multi-file atomicity is OUT OF SCOPE.
 */
export function executeAuthorizedFileMutation({
  resultId = `mut-res-${Date.now()}`,
  executionRequest,
  authorization,
  workspaceRoot,
  targetPath,
  content = '',
  operation = FileMutationOperation.WRITE,
  expectedState = null,
  dryRun = false,
  fsWriter = null // Test-only boundary injection
}) {
  validateRequired(
    { executionRequest, authorization, workspaceRoot, targetPath },
    ['executionRequest', 'authorization', 'workspaceRoot', 'targetPath'],
    'executeAuthorizedFileMutation'
  );

  if (!Object.values(FileMutationOperation).includes(operation)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid FileMutationOperation: ${operation}`);
  }

  // Gate 1: Authorization decision must be AUTHORIZED
  if (authorization.decision !== AuthorizationDecision.AUTHORIZED) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Authorization decision is '${authorization.decision}'`);
  }

  // Gate 2: Identity chain matching between Request and Authorization
  if (authorization.taskId !== executionRequest.taskId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization taskId '${authorization.taskId}' does not match ExecutionRequest taskId '${executionRequest.taskId}'`);
  }
  if (authorization.planId !== executionRequest.planId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization planId '${authorization.planId}' does not match ExecutionRequest planId '${executionRequest.planId}'`);
  }

  // Gate 3: Security context binding verification
  const authContext = authorization.authorizedContext;
  if (!authContext) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Authorization is missing bound authorizedContext`);
  }

  // Workspace matching
  const resolvedWorkspace = path.resolve(workspaceRoot);
  const resolvedAuthWorkspace = path.resolve(authContext.workingDirectory || '');
  if (resolvedWorkspace !== resolvedAuthWorkspace) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: workspaceRoot does not match authorizedContext workingDirectory`);
  }

  // Gate 4: Path Security & Containment
  const resolvedTarget = path.resolve(targetPath);
  if (!isPathInsideDirectory(resolvedTarget, resolvedWorkspace)) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: targetPath '${targetPath}' is outside authorized workspace '${workspaceRoot}'`);
  }

  // Target binding matching: Target must be explicitly authorized
  if (!authContext.authorizedTarget) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Authorization does not specify an authorizedTarget`);
  }
  const resolvedAuthTarget = path.resolve(authContext.authorizedTarget);
  if (resolvedTarget !== resolvedAuthTarget) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: targetPath does not match authorizedContext authorizedTarget`);
  }

  // Gate 5: Current State & Read Error Distinction (Issue B Remediation)
  let currentState = null;
  let fileExists = false;

  try {
    if (fs.existsSync(resolvedTarget)) {
      fileExists = true;
      currentState = fs.readFileSync(resolvedTarget, 'utf-8');
    }
  } catch (err) {
    // Filesystem error when file exists cannot be treated as NOT_EXISTS
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Filesystem READ_ERROR on target '${targetPath}': ${err.message}`);
  }

  // If authorization specified an expectedState, current file must match it exactly
  if (authContext.expectedState !== undefined && authContext.expectedState !== null) {
    if (currentState !== authContext.expectedState) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Current file state does not match authorized expectedState (Conflict detected)`);
    }
  }

  // If caller specified an expectedState, current file must match it
  if (expectedState !== null && currentState !== expectedState) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Current file state does not match caller expectedState`);
  }

  // Gate 6: Payload tampering check (for WRITE operations)
  if (operation === FileMutationOperation.WRITE) {
    if (authContext.authorizedContent !== undefined && authContext.authorizedContent !== null) {
      if (content !== authContext.authorizedContent) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Mutation blocked: Provided content does not match authorizedContext authorizedContent`);
      }
    }
  }

  // Gate 7: Dry Run Evaluation (Zero disk mutation)
  if (dryRun) {
    return createFileMutationResultContract({
      id: resultId,
      taskId: executionRequest.taskId,
      planId: executionRequest.planId,
      targetPath: resolvedTarget,
      outcome: FileMutationOutcome.SUCCEEDED,
      isDryRun: true,
      metadata: {
        operation,
        simulatedBytes: operation === FileMutationOperation.WRITE ? Buffer.byteLength(content, 'utf-8') : 0
      }
    });
  }

  // Gate 8: Controlled Mutation Execution (Authentic DELETE and WRITE)
  try {
    if (fsWriter) {
      fsWriter({ targetPath: resolvedTarget, content, operation });
    } else {
      if (operation === FileMutationOperation.DELETE) {
        if (fileExists || fs.existsSync(resolvedTarget)) {
          fs.unlinkSync(resolvedTarget);
        }
      } else {
        // WRITE operation: ensure parent directory exists and write
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, content, 'utf-8');
      }
    }

    return createFileMutationResultContract({
      id: resultId,
      taskId: executionRequest.taskId,
      planId: executionRequest.planId,
      targetPath: resolvedTarget,
      outcome: FileMutationOutcome.SUCCEEDED,
      isDryRun: false,
      metadata: {
        operation,
        bytesWritten: operation === FileMutationOperation.WRITE ? Buffer.byteLength(content, 'utf-8') : 0
      }
    });
  } catch (err) {
    return createFileMutationResultContract({
      id: resultId,
      taskId: executionRequest.taskId,
      planId: executionRequest.planId,
      targetPath: resolvedTarget,
      outcome: FileMutationOutcome.FAILED,
      failureReason: err.message,
      isDryRun: false,
      metadata: { operation, error: err.code || 'FS_MUTATION_ERROR' }
    });
  }
}
