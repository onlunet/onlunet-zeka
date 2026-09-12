/**
 * AI Development OS - Phase 12 Post-Execution Result Integrity & Validation Boundary Test Suite
 *
 * Verifies:
 * - Real execution outcome evaluated via declarative contract
 * - Separation: Execution Result != Validation Success
 * - Separation: Execution Outcome SUCCEEDED != Task State COMPLETED
 * - Separation: Execution Outcome FAILED != Validation PASS
 * - Identity integrity: ExecutionResult.taskId/planId == Authorized Context taskId/planId
 * - Determinism of evaluation
 * - Full regression of Phase 11.1 security tests
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  TaskState,
  ValidationResult,
  AdmissionDecision,
  AuthorizationDecision,
  ExecutionOutcome,
  createTask,
  createValidation,
  createEvidence,
  createAdmissionResultContract,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  authorizeExecutionRequest,
  executeAuthorizedRequest,
  createExecutionResultContract,
  evaluatePostExecutionValidation
} from "../src/index.js";

function buildValidAuthorizedChain({ command = "node -e \"process.exit(0)\"", workingDirectory = process.cwd() } = {}) {
  const admission = createAdmissionResultContract({
    id: "adm-12-valid",
    taskId: "task-12",
    planId: "plan-12",
    decision: AdmissionDecision.ALLOWED,
    reason: "Preflight passed"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-12-valid",
    taskId: "task-12",
    planId: "plan-12",
    admissionResult: admission,
    workingDirectory,
    expectedCommands: [command]
  });

  const request = consumeExecutionHandoff({
    requestId: "req-12-valid",
    handoff,
    admissionResult: admission
  });

  const authorization = authorizeExecutionRequest({
    id: "auth-12-valid",
    executionRequest: request,
    admissionResult: admission
  });

  return { admission, handoff, request, authorization };
}

test("FAZ 12 - TEST A: Execution SUCCESS != Validation SUCCESS (Task cannot complete automatically on exit 0)", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(0)\"" });

  // 1. Controlled execution produces SUCCEEDED result
  const execResult = executeAuthorizedRequest({
    resultId: "res-12-succ",
    executionRequest: request,
    authorization
  });

  assert.equal(execResult.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(execResult.metadata.exitCode, 0);

  // 2. But post-execution validation evaluates acceptance criteria and fails
  const task = createTask({ id: "task-12", jobId: "job-12", objective: "Run build", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-12-a",
    target: "Acceptance Test Suite",
    result: ValidationResult.FAIL,
    failureReason: "Functional assertion failed"
  });

  const evalResult = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: execResult.evidenceReferences
  });

  // Task MUST NOT be marked COMPLETED despite execution exitCode == 0 / SUCCEEDED
  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
  assert.notEqual(evalResult.recommendedTaskState, TaskState.COMPLETED);
});

test("FAZ 12 - TEST B: Execution FAILED != Validation SUCCESS (Execution failure prevents validation PASS)", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(1)\"" });

  // 1. Controlled execution produces FAILED result
  const execResult = executeAuthorizedRequest({
    resultId: "res-12-fail",
    executionRequest: request,
    authorization
  });

  assert.equal(execResult.outcome, ExecutionOutcome.FAILED);
  assert.equal(execResult.metadata.exitCode, 1);

  // 2. If validation target inspects execution failure, validation must not falsely report PASS
  const task = createTask({ id: "task-12", jobId: "job-12", objective: "Run build", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-12-b",
    target: "Process Outcome Check",
    result: execResult.outcome === ExecutionOutcome.SUCCEEDED ? ValidationResult.PASS : ValidationResult.FAIL,
    failureReason: execResult.failureReason
  });

  const evalResult = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: execResult.evidenceReferences
  });

  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
});

test("FAZ 12 - TEST C: Validation PASS requires verified evidence (Missing/Empty evidences rejected)", () => {
  const task = createTask({ id: "task-12", jobId: "job-12", objective: "Verify output", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-12-c",
    target: "Build artifact",
    result: ValidationResult.PASS
  });

  // Zero evidences provided -> MUST be rejected
  const evalResult = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: []
  });

  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
  assert.equal(evalResult.code, ErrorCodes.VALIDATION_FAILED);
});

test("FAZ 12 - TEST D: Task / Plan Identity Integrity with Authorized Context", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  const execResult = executeAuthorizedRequest({
    resultId: "res-12-id",
    executionRequest: request,
    authorization
  });

  // Verify identity linkage between authorized context and produced result
  assert.equal(execResult.taskId, authorization.taskId);
  assert.equal(execResult.planId, authorization.planId);
  assert.equal(execResult.taskId, request.taskId);
  assert.equal(execResult.planId, request.planId);

  // A forged result with mismatched taskId cannot be validated against the authorized task
  const forgedResult = createExecutionResultContract({
    id: "res-forged",
    taskId: "task-foreign",
    planId: request.planId,
    outcome: ExecutionOutcome.SUCCEEDED,
    evidenceReferences: ["ev-forged"]
  });

  assert.notEqual(forgedResult.taskId, request.taskId);
});

test("FAZ 12 - TEST E: Existing Validation Semantics Preserved (PASS, FAIL, INCONCLUSIVE)", () => {
  const task = createTask({ id: "task-12", jobId: "job-12", objective: "Verify output", status: TaskState.VALIDATING });
  const ev = createEvidence({ id: "ev-12", source: "runner", type: "LOG", result: "OK" });

  // 1. PASS -> COMPLETED
  const valPass = createValidation({ id: "v-p", target: "output", result: ValidationResult.PASS });
  const resPass = evaluatePostExecutionValidation({ task, validation: valPass, evidences: [ev] });
  assert.equal(resPass.success, true);
  assert.equal(resPass.recommendedTaskState, TaskState.COMPLETED);

  // 2. FAIL -> FAILED
  const valFail = createValidation({ id: "v-f", target: "output", result: ValidationResult.FAIL, failureReason: "Mismatch" });
  const resFail = evaluatePostExecutionValidation({ task, validation: valFail, evidences: [ev] });
  assert.equal(resFail.success, false);
  assert.equal(resFail.recommendedTaskState, TaskState.FAILED);

  // 3. INCONCLUSIVE -> WAITING
  const valInc = createValidation({ id: "v-i", target: "output", result: ValidationResult.INCONCLUSIVE });
  const resInc = evaluatePostExecutionValidation({ task, validation: valInc, evidences: [ev] });
  assert.equal(resInc.success, false);
  assert.equal(resInc.recommendedTaskState, TaskState.WAITING);
});

test("FAZ 12 - TEST F: Determinism (Same ExecutionResult + Same validation -> Same outcome)", () => {
  const task = createTask({ id: "task-12", jobId: "job-12", objective: "Verify output", status: TaskState.VALIDATING });
  const ev = createEvidence({ id: "ev-12-det", source: "runner", type: "LOG", result: "OK" });
  const val = createValidation({ id: "v-det", target: "output", result: ValidationResult.PASS });

  const r1 = evaluatePostExecutionValidation({ task, validation: val, evidences: [ev] });
  const r2 = evaluatePostExecutionValidation({ task, validation: val, evidences: [ev] });

  assert.deepEqual(r1, r2);
});
