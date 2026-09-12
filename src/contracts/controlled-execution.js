/**
 * AI Development OS - First Real Execution Boundary Foundation
 * Phase 11 & Phase 11.1 - Controlled Local Process Execution Boundary with Security Context Binding
 *
 * AUTHORIZATION IS THE ONLY EXECUTION GATE
 * AUTHORIZATION != EXECUTION
 * AUTHORIZED EXECUTION CONTEXT == ACTUALLY CONSUMED EXECUTION CONTEXT
 * ONE REQUEST -> ONE CONTROLLED PROCESS -> ONE DECLARATIVE RESULT
 * ZERO SHELL REINTERPRETATION / ZERO RETRY / ZERO QUEUE / ZERO WORKER / STRICT SCOPE LOCK
 */
import { spawnSync } from 'node:child_process';
import { ErrorCodes } from './constants.js';
import { AuthorizationDecision } from './execution-authorization.js';
import { ExecutionOutcome, createExecutionResultContract } from './execution-semantics.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Splits a command string into executable and arguments while preserving quoted parameters.
 */
function parseCommand(cmdString) {
  const trimmed = cmdString.trim();
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return {
    executable: tokens[0] || '',
    args: tokens.slice(1)
  };
}

/**
 * Executes a strictly authorized ExecutionRequest as a single, controlled local process.
 *
 * Rules:
 * 1. Authorization MUST be provided and its decision MUST be strictly AUTHORIZED.
 * 2. Identity and context integrity must strictly match between request and authorization.
 * 3. Exact execution context binding: Command and working directory MUST strictly match
 *    the authorized context bound within the authorization contract.
 * 4. Working directory must be explicit and non-empty; no silent fallback to process.cwd().
 * 5. No shell invocation by default (shell: false).
 * 6. One request -> exactly one process launch attempt -> exactly one ExecutionResult contract.
 * 7. No retry, no fallback, no background queues, no AI.
 */
export function executeAuthorizedRequest({
  resultId,
  executionRequest,
  authorization,
  commandRunner = spawnSync
}) {
  validateRequired({ resultId, executionRequest }, ['resultId', 'executionRequest'], 'executeAuthorizedRequest');

  // Gate 1: Authorization presence & decision verification
  if (!authorization || authorization.decision !== AuthorizationDecision.AUTHORIZED) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Request is not AUTHORIZED. Authorization is '${authorization ? authorization.decision : 'MISSING'}'.`);
  }

  // Gate 2: Identity chain consistency check between request and authorization
  if (authorization.requestId !== executionRequest.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization requestId '${authorization.requestId}' does not match ExecutionRequest id '${executionRequest.id}'`);
  }
  if (authorization.taskId !== executionRequest.taskId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization taskId '${authorization.taskId}' does not match ExecutionRequest taskId '${executionRequest.taskId}'`);
  }
  if (authorization.planId !== executionRequest.planId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization planId '${authorization.planId}' does not match ExecutionRequest planId '${executionRequest.planId}'`);
  }
  if (authorization.admissionId !== executionRequest.admissionId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization admissionId '${authorization.admissionId}' does not match ExecutionRequest admissionId '${executionRequest.admissionId}'`);
  }
  if (authorization.handoffId !== executionRequest.handoffId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Authorization handoffId '${authorization.handoffId}' does not match ExecutionRequest handoffId '${executionRequest.handoffId}'`);
  }

  // Gate 3: Extract authoritative execution context from the handoff reference
  const handoff = executionRequest.handoffReference;
  if (!handoff) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ExecutionRequest missing authoritative handoffReference`);
  }

  // Gate 4: Security Binding Verification (FAZ 11.1 Remediation)
  // AUTHORIZED EXECUTION CONTEXT == ACTUALLY CONSUMED EXECUTION CONTEXT
  const authContext = authorization.authorizedContext;
  if (!authContext) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Authorization is missing bound authorizedContext`);
  }

  // Working directory rule: must exist, be non-empty, and match authorized context exactly (no implicit fallback)
  const workingDirectory = handoff.workingDirectory;
  if (!workingDirectory || typeof workingDirectory !== 'string' || workingDirectory.trim() === '') {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Missing or invalid approved workingDirectory`);
  }
  if (workingDirectory !== authContext.workingDirectory) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Consumed workingDirectory does not match authorizedContext workingDirectory`);
  }

  // Command rule: must exist and match authorized context exactly
  const expectedCommands = handoff.expectedCommands || [];
  if (expectedCommands.length === 0) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] No authoritative commands specified in handoffReference`);
  }

  const authCommands = authContext.expectedCommands || [];
  if (authCommands.length === 0) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: No authorized commands in authorizedContext`);
  }

  if (expectedCommands[0] !== authCommands[0]) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Execution blocked: Consumed command does not match authorizedContext command`);
  }

  // Process launch: First authoritative command invocation
  const fullCommand = authCommands[0];
  const { executable, args } = parseCommand(fullCommand);

  // Controlled execution launch: shell is strictly FALSE
  const spawnOptions = {
    cwd: workingDirectory,
    shell: false,
    windowsHide: true,
    encoding: 'utf-8'
  };

  let outcome = ExecutionOutcome.SUCCEEDED;
  let failureReason = null;
  let metadata = { exitCode: 0 };

  try {
    const proc = commandRunner(executable, args, spawnOptions);

    if (proc.error) {
      outcome = ExecutionOutcome.FAILED;
      failureReason = proc.error.message;
      metadata = { exitCode: -1, error: proc.error.code || 'PROCESS_LAUNCH_ERROR' };
    } else if (proc.status !== 0) {
      outcome = ExecutionOutcome.FAILED;
      failureReason = `Process exited with non-zero status code: ${proc.status}`;
      metadata = { exitCode: proc.status };
    } else {
      outcome = ExecutionOutcome.SUCCEEDED;
      metadata = { exitCode: 0 };
    }
  } catch (err) {
    outcome = ExecutionOutcome.FAILED;
    failureReason = err.message;
    metadata = { exitCode: -1, error: err.code || 'PROCESS_ERROR' };
  }

  // Return Phase 6 compliant immutable ExecutionResultContract
  return createExecutionResultContract({
    id: resultId,
    taskId: executionRequest.taskId,
    planId: executionRequest.planId,
    outcome,
    evidenceReferences: [resultId],
    failureReason,
    metadata
  });
}
