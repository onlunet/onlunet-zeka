/**
 * AI Development OS - Orchestration Foundation Test Suite (FAZ 2 Master Requirements)
 * Tests:
 * Test A - Valid Workflow -> Job -> Task relationship
 * Test B - Invalid project ownership rejection
 * Test C - Task sequencing & dependency ordering
 * Test D - ExecutionPlan contract validation
 * Test E - Approval gate enforcement
 * Test F - Scope violation blocking
 * Test G - Policy separation verification
 * Test H - Terminal state re-execution rejection
 * Test I - Evidence requirement for validation
 * Test J - Validation failure prevents completion
 * Test K - Audit privacy preservation
 * Test L - Determinism (Same inputs -> Same decision)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectState,
  JobState,
  TaskState,
  ApprovalState,
  ValidationResult,
  ErrorCodes,
  createProject,
  createWorkflow,
  createJob,
  createTask,
  createExecutionPlan,
  createEvidence,
  createValidation,
  createApproval,
  createAuditRecord,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy,
  createOrchestrationPlan,
  resolveExecutionOrder,
  validateOrchestrationOwnership,
  evaluateTaskExecutionEligibility,
  evaluatePostExecutionValidation
} from "../src/index.js";

test("Test A: Valid Workflow -> Job -> Task relationship", () => {
  const project = createProject({ id: "p-1", name: "Alpha OS" });
  const workflow = createWorkflow({ id: "wf-1", projectId: "p-1", name: "Build WF", objective: "Build app" });
  const job = createJob({ id: "job-1", projectId: "p-1", workflowId: "wf-1" });
  const task1 = createTask({ id: "t-1", jobId: "job-1", objective: "Compile" });
  const task2 = createTask({ id: "t-2", jobId: "job-1", objective: "Test" });

  assert.equal(validateOrchestrationOwnership({ project, workflow, job, tasks: [task1, task2] }), true);
});

test("Test B: Invalid project ownership rejection (Negative Test)", () => {
  const projectA = createProject({ id: "p-A", name: "Alpha OS" });
  const projectB = createProject({ id: "p-B", name: "Beta OS" });

  const workflowB = createWorkflow({ id: "wf-B", projectId: "p-B", name: "WF", objective: "Obj" });
  const jobA = createJob({ id: "job-A", projectId: "p-A", workflowId: "wf-B" }); // Mismatched

  assert.throws(
    () => validateOrchestrationOwnership({ project: projectA, workflow: workflowB, job: jobA }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

test("Test C: Task sequencing & topological ordering", () => {
  const plan = createOrchestrationPlan({
    id: "orch-seq",
    workflowId: "wf-1",
    projectId: "p-1",
    tasks: ["deploy", "test", "build"],
    taskDependencies: {
      "build": [],
      "test": ["build"],
      "deploy": ["test"]
    }
  });

  const order = resolveExecutionOrder(plan);
  assert.deepEqual(order, ["build", "test", "deploy"]);
});

test("Test D: ExecutionPlan contract validation", () => {
  assert.throws(() => createExecutionPlan({ id: "", taskId: "t-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionPlan({ id: "ep-1", taskId: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  const plan = createExecutionPlan({
    id: "ep-valid",
    taskId: "t-1",
    steps: ["step-1"],
    expectedCommands: ["npm test"],
    risk: "LOW"
  });
  assert.equal(plan.id, "ep-valid");
  assert.equal(plan.risk, "LOW");
});

test("Test E: Approval gate enforcement (Negative & Positive)", () => {
  const task = createTask({ id: "t-sec", jobId: "job-1", objective: "DATABASE_MIGRATION", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "ep-sec", taskId: "t-sec", steps: ["migrate"] });
  const appPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["DATABASE_MIGRATION"] });

  // 1. Without approval -> BLOCKED / APPROVAL_REQUIRED
  const unapprovedEval = evaluateTaskExecutionEligibility({
    task,
    executionPlan: plan,
    approvalPolicy: appPolicy,
    approval: null
  });
  assert.equal(unapprovedEval.eligible, false);
  assert.equal(unapprovedEval.status, JobState.APPROVAL_REQUIRED);
  assert.equal(unapprovedEval.code, ErrorCodes.APPROVAL_REQUIRED);

  // 2. With approval granted -> READY
  const approved = createApproval({
    id: "app-1",
    actionType: "DATABASE_MIGRATION",
    reason: "Reviewed migration script",
    approvalState: ApprovalState.APPROVED
  });
  const approvedEval = evaluateTaskExecutionEligibility({
    task,
    executionPlan: plan,
    approvalPolicy: appPolicy,
    approval: approved
  });
  assert.equal(approvedEval.eligible, true);
  assert.equal(approvedEval.status, TaskState.READY);
});

test("Test F: Scope violation blocking (Negative Test)", () => {
  const task = createTask({ id: "t-scope", jobId: "job-1", objective: "Mod Files", status: TaskState.READY });
  const plan = createExecutionPlan({
    id: "ep-scope",
    taskId: "t-scope",
    expectedFileChanges: ["server.js"]
  });
  const scopePolicy = createScopePolicy({
    allowedSurfaces: ["FILES"],
    forbiddenSurfaces: ["INFRASTRUCTURE"],
    expectedFiles: ["src/index.js"] // server.js is unexpected
  });

  const evalResult = evaluateTaskExecutionEligibility({
    task,
    executionPlan: plan,
    scopePolicy
  });

  // Unexpected file requires approval or blocks
  assert.equal(evalResult.eligible, false);
  assert.equal(evalResult.status, JobState.APPROVAL_REQUIRED);
});

test("Test G: Policy separation (Scope != Execution != Security != Approval)", () => {
  const scopePolicy = createScopePolicy({ allowedSurfaces: ["FILES"], expectedFiles: ["src/index.js"] });
  const execPolicy = createExecutionPolicy({ allowedCommands: ["git"], allowedWorkingDirectories: ["d:/project"] });
  const secPolicy = createSecurityPolicy({ allowSecretExposure: false });
  const appPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["GIT_PUSH"] });

  const task = createTask({ id: "t-1", jobId: "j-1", objective: "Run Script", status: TaskState.READY });
  const plan = createExecutionPlan({
    id: "ep-1",
    taskId: "t-1",
    expectedFileChanges: ["src/index.js"],
    expectedCommands: ["git"]
  });

  const result = evaluateTaskExecutionEligibility({
    task,
    executionPlan: plan,
    workingDirectory: "c:/windows/system32", // Outside allowed dir
    scopePolicy,
    executionPolicy: execPolicy,
    securityPolicy: secPolicy,
    approvalPolicy: appPolicy
  });

  // Scope passes, but Execution policy correctly blocks with SECURITY_BLOCKED due to directory
  assert.equal(result.eligible, false);
  assert.equal(result.status, TaskState.BLOCKED);
  assert.equal(result.code, ErrorCodes.SECURITY_BLOCKED);
});

test("Test H: Terminal state re-execution rejection (Negative Test)", () => {
  const completedTask = createTask({ id: "t-comp", jobId: "j-1", objective: "Done", status: TaskState.COMPLETED });
  const plan = createExecutionPlan({ id: "ep-1", taskId: "t-comp" });

  const evalResult = evaluateTaskExecutionEligibility({
    task: completedTask,
    executionPlan: plan
  });

  assert.equal(evalResult.eligible, false);
  assert.equal(evalResult.code, ErrorCodes.INVALID_STATE_TRANSITION);
});

test("Test I: Evidence requirement for validation (Negative Test)", () => {
  const task = createTask({ id: "t-val", jobId: "j-1", objective: "Verify", status: TaskState.RUNNING });
  const val = createValidation({ id: "v-1", target: "Build output", result: ValidationResult.PASS });

  // No evidence provided -> FAILED
  const evalResult = evaluatePostExecutionValidation({
    task,
    validation: val,
    evidences: []
  });

  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
  assert.equal(evalResult.code, ErrorCodes.VALIDATION_FAILED);
});

test("Test J: Validation failure prevents task completion", () => {
  const task = createTask({ id: "t-val", jobId: "j-1", objective: "Verify", status: TaskState.RUNNING });
  const val = createValidation({
    id: "v-1",
    target: "Unit Tests",
    result: ValidationResult.FAIL,
    failureReason: "3 tests failed"
  });
  const ev = createEvidence({ id: "ev-1", source: "Runner", type: "TEST_OUTPUT", result: "FAILED" });

  const evalResult = evaluatePostExecutionValidation({
    task,
    validation: val,
    evidences: [ev]
  });

  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
});

test("Test K: Audit privacy preservation (Raw AI content rejected)", () => {
  assert.throws(
    () => createAuditRecord({
      id: "aud-err",
      actor: "Orchestrator",
      projectId: "p-1",
      action: "ORCHESTRATION_DECISION",
      result: "DECIDED",
      rawPrompt: "Secret text"
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  const validAudit = createAuditRecord({
    id: "aud-ok",
    actor: "Orchestrator",
    projectId: "p-1",
    action: "ORCHESTRATION_EVALUATION",
    result: "READY"
  });
  assert.equal(validAudit.id, "aud-ok");
  assert.equal(validAudit.rawPrompt, undefined);
});

test("Test L: Determinism (Same inputs -> Same decision)", () => {
  const task = createTask({ id: "t-det", jobId: "j-1", objective: "Deterministic", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "ep-det", taskId: "t-det", steps: ["stepA"] });

  const eval1 = evaluateTaskExecutionEligibility({ task, executionPlan: plan });
  const eval2 = evaluateTaskExecutionEligibility({ task, executionPlan: plan });

  assert.deepEqual(eval1, eval2);
});
