/**
 * ONLUNET ZEKA - Application Layer: Orchestration & Execution Pipeline Runner
 * Phase 13.1 Security & Pipeline Integrity Remediation
 *
 * Bridges Application requests directly through the unmodified FAZ 1–12 Core Pipeline:
 *
 * ExecutionPlanContract (Phase 3)
 *    ↓
 * Preflight Admission via evaluateExecutionPreflight() (Phase 7)
 *    ↓
 * Handoff via createExecutionHandoffContract() (Phase 8)
 *    ↓
 * Runtime Request via consumeExecutionHandoff() (Phase 9)
 *    ↓
 * Authorization & Exact Context Binding via authorizeExecutionRequest() (Phase 10 & 11.1)
 *    ↓
 * Controlled Execution via executeAuthorizedRequest() (Phase 11 & 11.1)
 *    ↓
 * Execution Result via createExecutionResultContract() (Phase 6 & 11)
 *    ↓
 * Post-Execution Validation via evaluatePostExecutionValidation() (Phase 12)
 *
 * ZERO BYPASS / ZERO DIRECT SPAWN / ZERO SHELL / STRICT CONTEXT BINDING
 */
import {
  ErrorCodes,
  TaskState,
  ApprovalState,
  ValidationResult,
  AdmissionDecision,
  createTask,
  createApproval,
  createExecutionPlanContract,
  evaluateExecutionPreflight,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  authorizeExecutionRequest,
  executeAuthorizedRequest,
  createValidation,
  evaluatePostExecutionValidation,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy
} from '../index.js';

export function runApplicationPipeline({
  taskId,
  planId,
  workspaceRoot,
  command,
  userApproval = true,
  authoritativePlan = null,
  scopePolicy = null,
  executionPolicy = null,
  securityPolicy = null,
  approvalPolicy = null,
  commandRunner
}) {
  if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] workspaceRoot is required for pipeline execution`);
  }
  if (!command || typeof command !== 'string' || command.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] command is required for pipeline execution`);
  }

  // 1. Authoritative Execution Plan & Identity Binding (Phase 3, Phase 20 & Phase 21)
  const effectivePlanId = authoritativePlan ? authoritativePlan.id : (planId || `plan-${Date.now()}`);
  let effectiveTaskId = authoritativePlan ? authoritativePlan.taskId : (taskId || `task-${Date.now()}`);
  if (authoritativePlan) {
    if (authoritativePlan.workspaceRoot && authoritativePlan.workspaceRoot !== workspaceRoot) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Authoritative plan workspaceRoot '${authoritativePlan.workspaceRoot}' does not match pipeline workspaceRoot '${workspaceRoot}'`);
    }
    // Phase 21: Verify caller planId if explicitly provided
    if (planId && planId !== authoritativePlan.id) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Caller planId '${planId}' does not match authoritative plan id '${authoritativePlan.id}'`);
    }
    // Phase 21: Verify caller taskId if explicitly provided; otherwise use authoritativePlan.taskId
    if (taskId && taskId !== authoritativePlan.taskId) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Caller taskId '${taskId}' does not match authoritative plan taskId '${authoritativePlan.taskId}'`);
    }
    effectiveTaskId = authoritativePlan.taskId || taskId;

    const expectedCmds = authoritativePlan.expectedCommands || [];
    if (!expectedCmds.includes(command)) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Client command '${command}' does not match authoritative plan commands: [${expectedCmds.join(', ')}]`);
    }
  }

  const executionPlan = authoritativePlan || createExecutionPlanContract({
    id: effectivePlanId,
    taskId: effectiveTaskId,
    expectedCommands: [command],
    expectedFileChanges: [],
    risk: 'LOW'
  });

  // 2. Task Construction (Phase 1 & 2)
  const task = createTask({
    id: effectiveTaskId,
    jobId: `job-${Date.now()}`,
    objective: `Execute: ${command}`,
    status: TaskState.READY
  });

  // 3. User Approval Representation (Phase 1 & 2)
  const approval = createApproval({
    id: `appr-${Date.now()}`,
    actionType: task.objective,
    reason: userApproval ? 'User approved execution' : 'User rejected execution',
    approvalState: userApproval ? ApprovalState.APPROVED : ApprovalState.REJECTED
  });

  // 4. Authoritative FAZ 7 Preflight Admission Evaluation
  // Application pipeline mandates user approval for executing commands
  const activeScopePolicy = scopePolicy || createScopePolicy({ allowedSurfaces: ['FILES'], allowedFiles: [] });
  const activeExecPolicy = executionPolicy || createExecutionPolicy({ allowedWorkingDirectories: [workspaceRoot] });
  const activeSecPolicy = securityPolicy || createSecurityPolicy({});
  const activeApprPolicy = approvalPolicy || createApprovalPolicy({
    mandatoryApprovalActions: ['ARCHITECTURE_CHANGE', 'DATABASE_MIGRATION', 'MAJOR_DEPENDENCY', 'DESTRUCTIVE_OPERATION', 'GIT_PUSH', 'EXTERNAL_INTEGRATION', task.objective]
  });

  const admission = evaluateExecutionPreflight({
    id: `adm-${Date.now()}`,
    task,
    executionPlan,
    workingDirectory: workspaceRoot,
    scopePolicy: activeScopePolicy,
    executionPolicy: activeExecPolicy,
    securityPolicy: activeSecPolicy,
    approvalPolicy: activeApprPolicy,
    approval
  });

  if (admission.decision !== AdmissionDecision.ALLOWED) {
    return {
      status: 'ADMISSION_DENIED',
      admission,
      executionResult: null,
      postValidation: null
    };
  }

  // 5. Execution Handoff Contract (Phase 8)
  const handoff = createExecutionHandoffContract({
    id: `h-${Date.now()}`,
    taskId: effectiveTaskId,
    planId: executionPlan.id,
    admissionResult: admission,
    workingDirectory: workspaceRoot,
    expectedCommands: executionPlan.expectedCommands
  });

  // 6. Runtime Consumption Request (Phase 9)
  const request = consumeExecutionHandoff({
    requestId: `req-${Date.now()}`,
    handoff,
    admissionResult: admission
  });

  // 7. Final Authorization Boundary & Context Binding (Phase 10 & 11.1)
  const authorization = authorizeExecutionRequest({
    id: `auth-${Date.now()}`,
    executionRequest: request,
    admissionResult: admission
  });

  // 8. Controlled Real Process Execution Boundary (Phase 11 & 11.1)
  const execOptions = {
    resultId: `res-${Date.now()}`,
    executionRequest: request,
    authorization
  };
  if (commandRunner) {
    execOptions.commandRunner = commandRunner;
  }

  const executionResult = executeAuthorizedRequest(execOptions);

  // 9. Post-Execution Validation Boundary (Phase 12)
  const validationTask = createTask({
    id: effectiveTaskId,
    jobId: task.jobId,
    objective: task.objective,
    status: TaskState.VALIDATING
  });

  const validationContract = createValidation({
    id: `val-${Date.now()}`,
    target: command,
    result: executionResult.outcome === 'SUCCEEDED' ? ValidationResult.PASS : ValidationResult.FAIL,
    failureReason: executionResult.failureReason
  });

  const postValidation = evaluatePostExecutionValidation({
    task: validationTask,
    validation: validationContract,
    evidences: executionResult.evidenceReferences
  });

  return {
    status: 'COMPLETED',
    admission,
    authorization,
    executionResult,
    postValidation
  };
}
