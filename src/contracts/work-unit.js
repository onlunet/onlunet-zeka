/**
 * AI Development OS - Controlled Work Execution Contract Foundation
 * Phase 40 - Work Unit Contract, Authority Admission & Execution Boundary
 *
 * REUSES EXISTING INFRASTRUCTURE:
 * - Authority Root: JobEngine (Jobs, Tasks, Plans, Results)
 * - Admission & Policy: evaluateExecutionPreflight, createExecutionHandoffContract, consumeExecutionHandoff, authorizeExecutionRequest
 * - Controlled Execution: executeAuthorizedRequest, executeAuthorizedFileMutation
 * - Verification: evaluatePostExecutionValidation
 *
 * INVARIANTS:
 * 1. A Work Unit represents an explicitly authorized execution attempt.
 * 2. Work Unit authority strictly follows: Tenant -> Workspace -> Job -> Plan -> Task -> Action.
 * 3. Work Unit status represents the execution attempt only; Job and Task lifecycle states remain strictly explicit.
 * 4. Zero automatic retries (maxRetries = 0).
 * 5. Fail-closed admission & execution.
 * 6. Zero new external dependencies / Zero AI providers / Zero queues / Zero worker pools.
 */
import path from 'node:path';
import {
  ErrorCodes,
  TaskState,
  ApprovalState,
  ValidationResult,
  WorkUnitStatus,
  WorkUnitActionType
} from './constants.js';
import { createTask, createApproval, createValidation } from './domain.js';
import { AdmissionDecision, evaluateExecutionPreflight } from './preflight.js';
import { createExecutionHandoffContract } from './handoff.js';
import { consumeExecutionHandoff } from './runtime-boundary.js';
import { authorizeExecutionRequest } from './execution-authorization.js';
import { executeAuthorizedRequest } from './controlled-execution.js';
import { executeAuthorizedFileMutation, FileMutationOperation } from './file-mutation.js';
import { evaluatePostExecutionValidation } from './orchestrator.js';
import {
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy
} from '../policies/policies.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] ' + entityName + ' requires field: ' + field);
    }
  }
}

export function createWorkUnit({
  id,
  tenantId,
  workspaceRoot,
  jobId,
  taskId,
  planId,
  action,
  status = WorkUnitStatus.PENDING,
  createdAt = new Date().toISOString(),
  startedAt = null,
  completedAt = null,
  executionResultId = null,
  verificationResult = null,
  error = null
}) {
  validateRequired({ id, tenantId, workspaceRoot, jobId, taskId, planId, action }, [
    'id', 'tenantId', 'workspaceRoot', 'jobId', 'taskId', 'planId', 'action'
  ], 'WorkUnit');

  if (!Object.values(WorkUnitStatus).includes(status)) {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Invalid WorkUnit status: ' + status);
  }
  if (!action || typeof action !== 'object') {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] WorkUnit action must be an object');
  }
  if (!Object.values(WorkUnitActionType).includes(action.type)) {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Invalid WorkUnit action type: ' + action.type);
  }

  if (action.type === WorkUnitActionType.COMMAND) {
    if (!action.command || typeof action.command !== 'string' || action.command.trim() === '') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] WorkUnit COMMAND action requires non-empty string command');
    }
  } else if (action.type === WorkUnitActionType.MUTATION) {
    if (!action.targetPath || typeof action.targetPath !== 'string' || action.targetPath.trim() === '') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] WorkUnit MUTATION action requires non-empty string targetPath');
    }
    if (typeof action.content !== 'string') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] WorkUnit MUTATION action requires string content');
    }
  }

  return Object.freeze({
    id: String(id).trim(),
    tenantId: String(tenantId).trim(),
    workspaceRoot: path.resolve(String(workspaceRoot).trim()),
    jobId: String(jobId).trim(),
    taskId: String(taskId).trim(),
    planId: String(planId).trim(),
    action: Object.freeze({ ...action }),
    status,
    createdAt,
    startedAt,
    completedAt,
    executionResultId,
    verificationResult,
    error: error ? Object.freeze({ ...error }) : null
  });
}

export function admitWorkUnit({ workUnit, jobEngine }) {
  if (!workUnit) {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] admitWorkUnit requires workUnit');
  }
  if (!jobEngine) {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] admitWorkUnit requires jobEngine');
  }

  const job = jobEngine.getJob(workUnit.jobId, { tenantId: workUnit.tenantId });
  if (!job) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Job \'' + workUnit.jobId + '\' not found');
  }

  if (job.workspaceReference) {
    const resolvedJobWorkspace = path.resolve(job.workspaceReference);
    if (resolvedJobWorkspace !== workUnit.workspaceRoot) {
      throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Workspace \'' + workUnit.workspaceRoot + '\' does not match Job workspace \'' + resolvedJobWorkspace + '\'');
    }
  }

  const task = jobEngine.getTask(workUnit.taskId, { tenantId: workUnit.tenantId });
  if (!task) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Task \'' + workUnit.taskId + '\' not found');
  }
  if (task.jobId !== workUnit.jobId) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Task \'' + workUnit.taskId + '\' parent jobId \'' + task.jobId + '\' does not match \'' + workUnit.jobId + '\'');
  }

  const plan = jobEngine.getJobPlan(workUnit.jobId, { tenantId: workUnit.tenantId });
  if (!plan) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: No authoritative plan exists for Job \'' + workUnit.jobId + '\'');
  }
  if (plan.id !== workUnit.planId) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Plan \'' + workUnit.planId + '\' does not match authoritative plan \'' + plan.id + '\'');
  }
  if (plan.taskId && plan.taskId !== workUnit.taskId) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Task \'' + workUnit.taskId + '\' does not match plan taskId \'' + plan.taskId + '\'');
  }
  if (plan.workspaceRoot && path.resolve(plan.workspaceRoot) !== workUnit.workspaceRoot) {
    throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Workspace \'' + workUnit.workspaceRoot + '\' does not match plan workspace \'' + plan.workspaceRoot + '\'');
  }

  if (workUnit.action.type === WorkUnitActionType.COMMAND) {
    const expected = plan.expectedCommands || [];
    if (!expected.includes(workUnit.action.command)) {
      throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Command \'' + workUnit.action.command + '\' is not authorized in plan expectedCommands: [' + expected.join(', ') + ']');
    }
  } else if (workUnit.action.type === WorkUnitActionType.MUTATION) {
    const expectedFiles = plan.expectedFileChanges || [];
    if (!expectedFiles.includes(workUnit.action.targetPath)) {
      throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] WorkUnit admission blocked: Target file \'' + workUnit.action.targetPath + '\' is not authorized in plan expectedFileChanges: [' + expectedFiles.join(', ') + ']');
    }
  }

  return Object.freeze({
    decision: AdmissionDecision.ALLOWED,
    workUnitId: workUnit.id,
    jobId: workUnit.jobId,
    taskId: workUnit.taskId,
    planId: workUnit.planId,
    timestamp: new Date().toISOString()
  });
}

export function executeWorkUnit({
  workUnit,
  jobEngine,
  commandRunner = undefined,
  userApproval = true
}) {
  admitWorkUnit({ workUnit, jobEngine });

  const plan = jobEngine.getJobPlan(workUnit.jobId, { tenantId: workUnit.tenantId });
  const startTime = new Date().toISOString();

  let executionOutcome = 'FAILED';
  let executionDetails = null;
  let verificationResult = ValidationResult.FAIL;
  let failureError = null;

  try {
    if (workUnit.action.type === WorkUnitActionType.COMMAND) {
      const task = createTask({
        id: workUnit.taskId,
        jobId: workUnit.jobId,
        objective: 'Execute WorkUnit command: ' + workUnit.action.command,
        status: TaskState.READY
      });

      const approval = createApproval({
        id: 'appr-' + workUnit.id,
        actionType: task.objective,
        reason: userApproval ? 'User approved WorkUnit execution' : 'User rejected WorkUnit execution',
        approvalState: userApproval ? ApprovalState.APPROVED : ApprovalState.REJECTED
      });

      const scopePolicy = createScopePolicy({ allowedSurfaces: ['FILES'], allowedFiles: [] });
      const execPolicy = createExecutionPolicy({ allowedWorkingDirectories: [workUnit.workspaceRoot] });
      const secPolicy = createSecurityPolicy({});
      const apprPolicy = createApprovalPolicy({
        mandatoryApprovalActions: [task.objective]
      });

      const admission = evaluateExecutionPreflight({
        id: 'adm-' + workUnit.id,
        task,
        executionPlan: plan,
        workingDirectory: workUnit.workspaceRoot,
        scopePolicy,
        executionPolicy: execPolicy,
        securityPolicy: secPolicy,
        approvalPolicy: apprPolicy,
        approval
      });

      if (admission.decision !== AdmissionDecision.ALLOWED) {
        executionOutcome = 'DENIED';
        failureError = { code: ErrorCodes.APPROVAL_REQUIRED, message: admission.reason };
      } else {
        const handoff = createExecutionHandoffContract({
          id: 'h-' + workUnit.id,
          taskId: workUnit.taskId,
          planId: plan.id,
          admissionResult: admission,
          workingDirectory: workUnit.workspaceRoot,
          expectedCommands: [workUnit.action.command]
        });

        const request = consumeExecutionHandoff({
          requestId: 'req-' + workUnit.id,
          handoff,
          admissionResult: admission
        });

        const authorization = authorizeExecutionRequest({
          id: 'auth-' + workUnit.id,
          executionRequest: request,
          admissionResult: admission
        });

        const execOptions = {
          resultId: 'res-' + workUnit.id,
          executionRequest: request,
          authorization
        };
        if (commandRunner) {
          execOptions.commandRunner = commandRunner;
        }

        const execResult = executeAuthorizedRequest(execOptions);
        executionDetails = execResult;
        executionOutcome = execResult.outcome === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';

        const validationContract = createValidation({
          id: 'val-' + workUnit.id,
          target: workUnit.action.command,
          result: execResult.outcome === 'SUCCEEDED' ? ValidationResult.PASS : ValidationResult.FAIL,
          failureReason: execResult.failureReason
        });
        const postValidation = evaluatePostExecutionValidation({
          task: createTask({ id: workUnit.taskId, jobId: workUnit.jobId, objective: task.objective, status: TaskState.VALIDATING }),
          validation: validationContract,
          evidences: execResult.evidenceReferences
        });
        verificationResult = postValidation.success ? ValidationResult.PASS : ValidationResult.FAIL;
        if (executionOutcome !== 'SUCCEEDED') {
          failureError = { code: ErrorCodes.NOT_VERIFIED, message: execResult.failureReason || 'Command execution failed' };
        }
      }
    } else if (workUnit.action.type === WorkUnitActionType.MUTATION) {
      const task = createTask({
        id: workUnit.taskId,
        jobId: workUnit.jobId,
        objective: 'Mutate file: ' + workUnit.action.targetPath,
        status: TaskState.READY
      });
      const approval = createApproval({
        id: 'appr-' + workUnit.id,
        actionType: task.objective,
        reason: userApproval ? 'User approved WorkUnit mutation' : 'User rejected WorkUnit mutation',
        approvalState: userApproval ? ApprovalState.APPROVED : ApprovalState.REJECTED
      });
      const scopePolicy = createScopePolicy({ allowedSurfaces: ['FILES'], allowedFiles: [workUnit.action.targetPath] });
      const execPolicy = createExecutionPolicy({ allowedWorkingDirectories: [workUnit.workspaceRoot] });
      const secPolicy = createSecurityPolicy({});
      const apprPolicy = createApprovalPolicy({ mandatoryApprovalActions: [task.objective] });
      const admission = evaluateExecutionPreflight({
        id: 'adm-' + workUnit.id,
        task,
        executionPlan: plan,
        workingDirectory: workUnit.workspaceRoot,
        scopePolicy,
        executionPolicy: execPolicy,
        securityPolicy: secPolicy,
        approvalPolicy: apprPolicy,
        approval
      });

      if (admission.decision !== AdmissionDecision.ALLOWED) {
        executionOutcome = 'DENIED';
        failureError = { code: ErrorCodes.APPROVAL_REQUIRED, message: admission.reason };
      } else {
        const handoff = createExecutionHandoffContract({
          id: 'h-' + workUnit.id,
          taskId: workUnit.taskId,
          planId: plan.id,
          admissionResult: admission,
          workingDirectory: workUnit.workspaceRoot,
          expectedCommands: []
        });
        const request = consumeExecutionHandoff({
          requestId: 'req-' + workUnit.id,
          handoff,
          admissionResult: admission
        });
        const authorization = authorizeExecutionRequest({
          id: 'auth-' + workUnit.id,
          executionRequest: request,
          admissionResult: admission
        });

        const resolvedTarget = path.resolve(workUnit.workspaceRoot, workUnit.action.targetPath);
        const boundAuthorization = Object.freeze({
          ...authorization,
          authorizedContext: Object.freeze({
            ...authorization.authorizedContext,
            authorizedTarget: resolvedTarget,
            authorizedContent: workUnit.action.content
          })
        });

        const mutOp = workUnit.action.operation === 'DELETE'
          ? FileMutationOperation.DELETE
          : FileMutationOperation.WRITE;

        const mutResult = executeAuthorizedFileMutation({
          resultId: 'mut-' + workUnit.id,
          executionRequest: request,
          authorization: boundAuthorization,
          workspaceRoot: workUnit.workspaceRoot,
          targetPath: resolvedTarget,
          content: workUnit.action.content,
          operation: mutOp
        });
        executionDetails = mutResult;
        executionOutcome = mutResult.outcome === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';
        verificationResult = mutResult.outcome === 'SUCCEEDED' ? ValidationResult.PASS : ValidationResult.FAIL;
        if (executionOutcome !== 'SUCCEEDED') {
          failureError = { code: ErrorCodes.NOT_VERIFIED, message: mutResult.failureReason || 'File mutation failed' };
        }
      }
    }
  } catch (err) {
    executionOutcome = 'FAILED';
    verificationResult = ValidationResult.FAIL;
    failureError = { code: ErrorCodes.NOT_VERIFIED, message: err.message };
  }

  const endTime = new Date().toISOString();

  const recorded = jobEngine.recordExecutionResult(workUnit.jobId, {
    taskId: workUnit.taskId,
    planId: workUnit.planId,
    outcome: executionOutcome,
    result: {
      workUnitId: workUnit.id,
      action: workUnit.action,
      executionDetails,
      verificationResult,
      error: failureError
    },
    timestamp: endTime
  }, { tenantId: workUnit.tenantId });

  const finalStatus = executionOutcome === 'SUCCEEDED'
    ? WorkUnitStatus.SUCCEEDED
    : (executionOutcome === 'DENIED' ? WorkUnitStatus.DENIED : WorkUnitStatus.FAILED);

  return createWorkUnit({
    ...workUnit,
    status: finalStatus,
    startedAt: startTime,
    completedAt: endTime,
    executionResultId: recorded.id,
    verificationResult,
    error: failureError
  });
}
