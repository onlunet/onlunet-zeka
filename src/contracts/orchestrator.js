/**
 * AI Development OS - Orchestration Foundation Contract
 * Phase 2 - Pure Deterministic Contract-Level Orchestration Evaluator
 *
 * Evaluates: Workflow -> Job -> Task -> ExecutionPlan -> Policies -> Approval -> Validation -> Evidence -> Audit
 * ZERO REAL EXECUTION / ZERO LIVE AI / ZERO DATABASE / ZERO WORKER / STRICT SCOPE LOCK
 */
import {
  ErrorCodes,
  JobState,
  TaskState,
  ScopeDecision,
  ValidationResult
} from './constants.js';
import { validateStateTransition } from './domain.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Validates structural ownership and cross-entity relationships
 * between Project, Workflow, Job, and Tasks.
 */
export function validateOrchestrationOwnership({ project, workflow, job, tasks = [] }) {
  validateRequired({ project, workflow, job }, ['project', 'workflow', 'job'], 'OrchestrationOwnership');

  if (workflow.projectId !== project.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Workflow projectId '${workflow.projectId}' does not match Project '${project.id}'`);
  }

  if (job.projectId !== project.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Job projectId '${job.projectId}' does not match Project '${project.id}'`);
  }

  if (job.workflowId !== workflow.id) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Job workflowId '${job.workflowId}' does not match Workflow '${workflow.id}'`);
  }

  for (const task of tasks) {
    if (task.jobId !== job.id) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task jobId '${task.jobId}' does not match Job '${job.id}'`);
    }
  }

  return true;
}

/**
 * Pure Pre-Execution Orchestration Evaluator.
 * Evaluates whether a task and its execution plan are eligible for execution based on:
 * 1. Task State & Terminal State Verification
 * 2. Scope Policy evaluation
 * 3. Execution Policy evaluation
 * 4. Security Policy evaluation
 * 5. Approval Policy & Approval Gate status
 *
 * Deterministic: Same input -> Same decision.
 * ZERO side effects, ZERO shell execution, ZERO AI.
 */
export function evaluateTaskExecutionEligibility({
  task,
  executionPlan,
  workingDirectory = '',
  isPrivileged = false,
  scopePolicy,
  executionPolicy,
  securityPolicy,
  approvalPolicy,
  approval = null
}) {
  validateRequired({ task, executionPlan }, ['task', 'executionPlan'], 'evaluateTaskExecutionEligibility');

  // 1. Task State Check: Terminal state tasks cannot be re-executed
  if (task.status === TaskState.COMPLETED || task.status === TaskState.FAILED) {
    return Object.freeze({
      eligible: false,
      status: TaskState.BLOCKED,
      reason: `Task is in terminal state '${task.status}' and cannot be executed`,
      code: ErrorCodes.INVALID_STATE_TRANSITION
    });
  }

  // 2. Scope Evaluation (Scope Policy comes first)
  if (scopePolicy && executionPlan.expectedFileChanges) {
    for (const file of executionPlan.expectedFileChanges) {
      const scopeCheck = scopePolicy.evaluateChange({ surface: 'FILES', targetFile: file });
      if (scopeCheck.decision === ScopeDecision.SCOPE_VIOLATION) {
        return Object.freeze({
          eligible: false,
          status: TaskState.BLOCKED,
          reason: `Scope violation: ${scopeCheck.reason}`,
          code: ErrorCodes.SCOPE_VIOLATION
        });
      }
      if (scopeCheck.decision === ScopeDecision.APPROVAL_REQUIRED && (!approval || approval.approvalState !== 'APPROVED')) {
        return Object.freeze({
          eligible: false,
          status: JobState.APPROVAL_REQUIRED,
          reason: `Scope requires user approval: ${scopeCheck.reason}`,
          code: ErrorCodes.APPROVAL_REQUIRED
        });
      }
    }
  }

  // 3. Execution Policy Evaluation
  if (executionPolicy && executionPlan.expectedCommands) {
    for (const cmd of executionPlan.expectedCommands) {
      const execCheck = executionPolicy.evaluateCommand({
        executable: cmd,
        workingDirectory,
        isPrivileged
      });
      if (!execCheck.allowed) {
        return Object.freeze({
          eligible: false,
          status: TaskState.BLOCKED,
          reason: `Execution blocked by policy: ${execCheck.reason}`,
          code: execCheck.code || ErrorCodes.SECURITY_BLOCKED
        });
      }
    }
  }

  // 4. Security Policy Evaluation
  if (securityPolicy) {
    const secCheck = securityPolicy.evaluateAction({
      actionType: 'TASK_EXECUTION',
      hasSecrets: executionPlan.hasSecrets || false,
      isExternalWrite: executionPlan.isExternalWrite || false
    });
    if (!secCheck.allowed) {
      return Object.freeze({
        eligible: false,
        status: TaskState.BLOCKED,
        reason: `Security policy blocked action: ${secCheck.reason}`,
        code: secCheck.code || ErrorCodes.SECURITY_BLOCKED
      });
    }
  }

  // 5. Approval Policy Evaluation
  if (approvalPolicy) {
    const appCheck = approvalPolicy.isApprovalRequired({
      actionType: task.objective,
      riskLevel: executionPlan.risk || 'LOW'
    });
    if (appCheck.required) {
      if (!approval || approval.approvalState !== 'APPROVED') {
        return Object.freeze({
          eligible: false,
          status: JobState.APPROVAL_REQUIRED,
          reason: `Mandatory user approval required: ${appCheck.reason}`,
          code: ErrorCodes.APPROVAL_REQUIRED
        });
      }
    }
  }

  // Eligible for state transition to READY or RUNNING
  return Object.freeze({
    eligible: true,
    status: TaskState.READY,
    reason: 'Task and execution plan satisfy all policy, scope, and approval gates'
  });
}

/**
 * Pure Post-Execution Validation Evaluator.
 * Evaluates whether validation results and evidences warrant transitioning task to COMPLETED or FAILED.
 *
 * Rules:
 * - Missing or inconclusive validation cannot mark task COMPLETED.
 * - Validation failure transitions task to FAILED or BLOCKED.
 * - Requires verified evidence references.
 */
export function evaluatePostExecutionValidation({ task, validation, evidences = [] }) {
  validateRequired({ task, validation }, ['task', 'validation'], 'evaluatePostExecutionValidation');

  // Verify evidence requirement
  if (!evidences || evidences.length === 0) {
    return Object.freeze({
      success: false,
      recommendedTaskState: TaskState.FAILED,
      reason: 'Validation requires evidence; no evidence provided',
      code: ErrorCodes.VALIDATION_FAILED
    });
  }

  // Evaluate Validation Result
  if (validation.result === ValidationResult.FAIL) {
    return Object.freeze({
      success: false,
      recommendedTaskState: TaskState.FAILED,
      reason: `Validation failed: ${validation.failureReason || 'Acceptance criteria not met'}`,
      code: ErrorCodes.VALIDATION_FAILED
    });
  }

  if (validation.result === ValidationResult.INCONCLUSIVE) {
    return Object.freeze({
      success: false,
      recommendedTaskState: TaskState.WAITING,
      reason: 'Validation is inconclusive; task cannot be marked completed',
      code: ErrorCodes.NOT_VERIFIED
    });
  }

  if (validation.result === ValidationResult.PASS) {
    // Check if legal to transition to COMPLETED
    validateStateTransition('TASK', task.status, TaskState.COMPLETED);

    return Object.freeze({
      success: true,
      recommendedTaskState: TaskState.COMPLETED,
      reason: 'Validation passed with verified evidence references'
    });
  }

  throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unknown validation result: ${validation.result}`);
}
