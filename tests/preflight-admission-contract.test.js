/**
 * AI Development OS - Execution Preflight & Admission Contract Test Suite
 * Validates Phase 7 Execution Preflight & Admission Foundation
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  TaskState,
  ApprovalState,
  AdmissionDecision,
  createAdmissionResultContract,
  evaluateExecutionPreflight,
  createTask,
  createExecutionPlan,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy,
  createApproval,
  createExecutionResultContract,
  ExecutionOutcome
} from "../src/index.js";

test("FAZ 7 - 1: Valid Admission Result Contract Construction & Immutability", () => {
  const admission = createAdmissionResultContract({
    id: "adm-01",
    taskId: "task-01",
    planId: "plan-01",
    decision: AdmissionDecision.ALLOWED,
    reason: "All preflight criteria passed"
  });

  assert.equal(admission.id, "adm-01");
  assert.equal(admission.taskId, "task-01");
  assert.equal(admission.planId, "plan-01");
  assert.equal(admission.decision, AdmissionDecision.ALLOWED);
  assert.equal(admission.reason, "All preflight criteria passed");
  assert.equal(admission.code, null);

  // Immutability test
  assert.throws(() => { admission.decision = AdmissionDecision.DENIED; }, TypeError);
});

test("FAZ 7 - 2: Missing Required Identity Fields Rejection", () => {
  assert.throws(() => createAdmissionResultContract({ id: "", taskId: "t-1", planId: "p-1", decision: "ALLOWED", reason: "ok" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createAdmissionResultContract({ id: "a-1", taskId: "", planId: "p-1", decision: "ALLOWED", reason: "ok" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createAdmissionResultContract({ id: "a-1", taskId: "t-1", planId: "", decision: "ALLOWED", reason: "ok" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createAdmissionResultContract({ id: "a-1", taskId: "t-1", planId: "p-1", decision: "ALLOWED", reason: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("FAZ 7 - 3: Preflight Admission Decision = ALLOWED when all policies pass", () => {
  const task = createTask({ id: "t-adm-ok", jobId: "job-1", objective: "Run Unit Test", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "p-adm-ok", taskId: "t-adm-ok", steps: ["test"], expectedCommands: ["npm test"] });
  const execPolicy = createExecutionPolicy({ allowedCommands: ["npm test"] });

  const result = evaluateExecutionPreflight({
    id: "adm-eval-1",
    task,
    executionPlan: plan,
    executionPolicy: execPolicy
  });

  assert.equal(result.decision, AdmissionDecision.ALLOWED);
  assert.equal(result.taskId, "t-adm-ok");
  assert.equal(result.planId, "p-adm-ok");
});

test("FAZ 7 - 4: Scope Violation Denial (Negative Preflight Test)", () => {
  const task = createTask({ id: "t-scope-err", jobId: "job-1", objective: "Change Files", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "p-scope-err", taskId: "t-scope-err", expectedFileChanges: ["forbidden.env"] });
  const scopePolicy = createScopePolicy({
    allowedSurfaces: ["FILES"],
    forbiddenSurfaces: ["ENVIRONMENT"]
  });

  const result = evaluateExecutionPreflight({
    id: "adm-eval-2",
    task,
    executionPlan: plan,
    scopePolicy
  });

  assert.equal(result.decision, AdmissionDecision.DENIED);
});

test("FAZ 7 - 5: Policy Denial (Restricted Working Directory)", () => {
  const task = createTask({ id: "t-dir-err", jobId: "job-1", objective: "Run Command", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "p-dir-err", taskId: "t-dir-err", expectedCommands: ["git"] });
  const execPolicy = createExecutionPolicy({
    allowedCommands: ["git"],
    allowedWorkingDirectories: ["d:/project"]
  });

  const result = evaluateExecutionPreflight({
    id: "adm-eval-3",
    task,
    executionPlan: plan,
    workingDirectory: "c:/windows/system32",
    executionPolicy: execPolicy
  });

  assert.equal(result.decision, AdmissionDecision.DENIED);
  assert.equal(result.code, ErrorCodes.SECURITY_BLOCKED);
});

test("FAZ 7 - 6: Approval Denial when Mandatory Approval Missing", () => {
  const task = createTask({ id: "t-app-err", jobId: "job-1", objective: "DEPLOY_PROD", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "p-app-err", taskId: "t-app-err", risk: "HIGH" });
  const appPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["DEPLOY_PROD"] });

  // Missing approval -> DENIED
  const deniedResult = evaluateExecutionPreflight({
    id: "adm-eval-4",
    task,
    executionPlan: plan,
    approvalPolicy: appPolicy,
    approval: null
  });

  assert.equal(deniedResult.decision, AdmissionDecision.DENIED);
  assert.equal(deniedResult.code, ErrorCodes.APPROVAL_REQUIRED);

  // With granted approval -> ALLOWED
  const approved = createApproval({ id: "app-grant", actionType: "DEPLOY_PROD", reason: "Reviewed", approvalState: ApprovalState.APPROVED });
  const allowedResult = evaluateExecutionPreflight({
    id: "adm-eval-5",
    task,
    executionPlan: plan,
    approvalPolicy: appPolicy,
    approval: approved
  });

  assert.equal(allowedResult.decision, AdmissionDecision.ALLOWED);
});

test("FAZ 7 - 7: Terminal Task Denial (Completed/Failed Cannot Enter Preflight)", () => {
  const completedTask = createTask({ id: "t-term", jobId: "job-1", objective: "Done", status: TaskState.COMPLETED });
  const plan = createExecutionPlan({ id: "p-term", taskId: "t-term" });

  const result = evaluateExecutionPreflight({
    id: "adm-eval-6",
    task: completedTask,
    executionPlan: plan
  });

  assert.equal(result.decision, AdmissionDecision.DENIED);
  assert.equal(result.code, ErrorCodes.INVALID_STATE_TRANSITION);
});

test("FAZ 7 - 8: Invariant Distinction (Admission Result != Execution Result)", () => {
  // Preflight Admission: "Can execution be admitted?"
  const admission = createAdmissionResultContract({
    id: "adm-check",
    taskId: "t-diff",
    planId: "p-diff",
    decision: AdmissionDecision.ALLOWED,
    reason: "Preflight OK"
  });
  assert.equal(admission.decision, AdmissionDecision.ALLOWED);
  assert.equal(admission.outcome, undefined);

  // Execution Result: "What happened when executed?"
  const execution = createExecutionResultContract({
    id: "exec-check",
    taskId: "t-diff",
    planId: "p-diff",
    outcome: ExecutionOutcome.SUCCEEDED
  });
  assert.equal(execution.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(execution.decision, undefined);
});

test("FAZ 7 - 9: Determinism & Negative Security Tests (No Executable Methods)", () => {
  const task = createTask({ id: "t-det", jobId: "j-1", objective: "Test Det", status: TaskState.READY });
  const plan = createExecutionPlan({ id: "p-det", taskId: "t-det" });

  const res1 = evaluateExecutionPreflight({ id: "adm-det-1", task, executionPlan: plan });
  const res2 = evaluateExecutionPreflight({ id: "adm-det-1", task, executionPlan: plan });

  assert.deepEqual(res1, res2);

  // Negative security check: no executable methods on admission result
  assert.equal(res1.run, undefined);
  assert.equal(res1.execute, undefined);
  assert.equal(res1.dispatch, undefined);
  assert.equal(res1.spawn, undefined);
  assert.equal(res1.fork, undefined);
  assert.equal(res1.queue, undefined);
  assert.equal(res1.schedule, undefined);
});
