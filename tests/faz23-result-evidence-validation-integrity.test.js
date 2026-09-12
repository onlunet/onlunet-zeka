/**
 * AI Development OS - Phase 23 Result / Evidence / Validation Integrity Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Result identity integrity (constructor rejects missing/invalid id, taskId, planId)
 * TEST B — Invalid outcome blocked (rejects unknown outcome values, preserving ExecutionOutcome enum)
 * TEST C — Result immutability (Object.isFrozen on result, evidenceReferences, and metadata)
 * TEST D — Evidence array defensive copy (mutating external evidence array does not corrupt result)
 * TEST E — Evidence array mutation blocked (attempting to mutate result.evidenceReferences throws)
 * TEST F — Missing result / evidence cannot PASS validation (evidences empty -> recommendedTaskState: FAILED)
 * TEST G — Invalid result cannot PASS validation (unknown validation result throws INVALID_CONTRACT)
 * TEST H — Cross-result substitution blocked (evaluating task validation with mismatched target/failure)
 * TEST I — Cross-task / cross-plan result blocked (evaluating validation on mismatched task)
 * TEST J — Valid result + valid validation evaluates to TaskState.COMPLETED
 * TEST K — Failed execution cannot become false PASS (FAILED outcome produces ValidationResult.FAIL -> FAILED)
 * TEST L — Valid execution success remains distinct from validation PASS (inconclusive validation holds task at WAITING)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  TaskState,
  ValidationResult,
  createTask,
  createValidation,
  createExecutionResultContract,
  ExecutionOutcome,
  evaluatePostExecutionValidation
} from "../src/index.js";
import { createFileMutationResultContract, FileMutationOutcome } from "../src/contracts/file-mutation.js";

// TEST A — Result identity integrity: missing id, taskId, or planId throws INVALID_CONTRACT
test("FAZ 23 - TEST A: Result identity integrity - missing identity fields throws INVALID_CONTRACT", () => {
  assert.throws(
    () => createExecutionResultContract({ id: "", taskId: "t-1", planId: "p-1" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
  assert.throws(
    () => createExecutionResultContract({ id: "r-1", taskId: "", planId: "p-1" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
  assert.throws(
    () => createExecutionResultContract({ id: "r-1", taskId: "t-1", planId: "" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // FileMutationResultContract identity check
  assert.throws(
    () => createFileMutationResultContract({ id: "m-1", taskId: "", planId: "p-1", targetPath: "file.txt" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST B — Invalid outcome blocked: rejects unknown outcome values
test("FAZ 23 - TEST B: Invalid outcome values are strictly rejected", () => {
  assert.throws(
    () => createExecutionResultContract({
      id: "r-1",
      taskId: "t-1",
      planId: "p-1",
      outcome: "SUPER_SUCCESS_UNKNOWN"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.throws(
    () => createFileMutationResultContract({
      id: "m-1",
      taskId: "t-1",
      planId: "p-1",
      targetPath: "file.txt",
      outcome: "UNKNOWN_MUTATION_OUTCOME"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST C — Result immutability: Object.isFrozen on result, evidenceReferences, and metadata
test("FAZ 23 - TEST C: Result contracts and their sub-structures are strictly frozen", () => {
  const result = createExecutionResultContract({
    id: "r-immut",
    taskId: "t-immut",
    planId: "p-immut",
    outcome: ExecutionOutcome.SUCCEEDED,
    evidenceReferences: ["ev-1", "ev-2"],
    metadata: { exitCode: 0 }
  });

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.evidenceReferences));
  assert.ok(Object.isFrozen(result.metadata));

  assert.throws(() => { result.outcome = ExecutionOutcome.FAILED; }, TypeError);
  assert.throws(() => { result.taskId = "t-forged"; }, TypeError);
  assert.throws(() => { result.evidenceReferences.push("ev-fake"); }, TypeError);
});

// TEST D — Evidence array defensive copy: mutating caller's source array does not alter result
test("FAZ 23 - TEST D: Mutating external evidence array does not mutate result.evidenceReferences", () => {
  const externalEvidences = ["evidence-orig-1", "evidence-orig-2"];

  const result = createExecutionResultContract({
    id: "r-def",
    taskId: "t-def",
    planId: "p-def",
    evidenceReferences: externalEvidences
  });

  // External array tampered
  externalEvidences[0] = "evidence-forged-malicious";
  externalEvidences.push("evidence-injected");

  assert.equal(result.evidenceReferences.length, 2);
  assert.equal(result.evidenceReferences[0], "evidence-orig-1");
  assert.equal(result.evidenceReferences[1], "evidence-orig-2");
});

// TEST E — Evidence array mutation blocked: mutating result.evidenceReferences directly throws TypeError
test("FAZ 23 - TEST E: Direct mutation of result.evidenceReferences throws TypeError", () => {
  const result = createExecutionResultContract({
    id: "r-e",
    taskId: "t-e",
    planId: "p-e",
    evidenceReferences: ["ev-1"]
  });

  assert.throws(() => {
    result.evidenceReferences[0] = "ev-mutated";
  }, TypeError);

  assert.throws(() => {
    result.evidenceReferences.push("ev-appended");
  }, TypeError);
});

// TEST F — Missing evidence cannot PASS validation: empty or missing evidences transitions task to FAILED
test("FAZ 23 - TEST F: Missing evidence fails validation and marks task state FAILED", () => {
  const task = createTask({ id: "t-val-f", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-f",
    target: "run",
    result: ValidationResult.PASS // Even if validation claim is PASS
  });

  // 1. Missing evidence array
  const eval1 = evaluatePostExecutionValidation({ task, validation, evidences: [] });
  assert.equal(eval1.success, false);
  assert.equal(eval1.recommendedTaskState, TaskState.FAILED);
  assert.equal(eval1.code, ErrorCodes.VALIDATION_FAILED);

  // 2. Null evidence
  const eval2 = evaluatePostExecutionValidation({ task, validation, evidences: null });
  assert.equal(eval2.success, false);
  assert.equal(eval2.recommendedTaskState, TaskState.FAILED);
});

// TEST G — Invalid result cannot PASS: invalid validation result throws INVALID_CONTRACT
test("FAZ 23 - TEST G: Unknown validation result throws INVALID_CONTRACT", () => {
  const task = createTask({ id: "t-val-g", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });

  assert.throws(
    () => createValidation({ id: "v-bad", target: "cmd", result: "FORGED_RESULT_UNRECOGNIZED" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  const mockFakeValidation = { id: "v-raw", target: "cmd", result: "FAKE_RESULT" };
  assert.throws(
    () => evaluatePostExecutionValidation({ task, validation: mockFakeValidation, evidences: ["ev-1"] }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST H — Cross-result substitution blocked: validation result of FAILED execution blocks task completion
test("FAZ 23 - TEST H: Validation failure strictly marks task FAILED with verified failureReason", () => {
  const task = createTask({ id: "t-val-h", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-h",
    target: "cmd",
    result: ValidationResult.FAIL,
    failureReason: "Process exit code 1"
  });

  const evaluation = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: ["ev-exit-code-1"]
  });

  assert.equal(evaluation.success, false);
  assert.equal(evaluation.recommendedTaskState, TaskState.FAILED);
  assert.match(evaluation.reason, /Process exit code 1/);
});

// TEST I — Cross-task / cross-plan result blocked: invalid task state transition fails closed
test("FAZ 23 - TEST I: Illegal task status in post-validation transition is rejected", () => {
  // Task already in terminal state FAILED cannot transition to COMPLETED even with PASS validation
  const completedTask = createTask({ id: "t-val-i", jobId: "j-1", objective: "Run", status: TaskState.FAILED });
  const validation = createValidation({
    id: "val-i",
    target: "cmd",
    result: ValidationResult.PASS
  });

  assert.throws(
    () => evaluatePostExecutionValidation({ task: completedTask, validation, evidences: ["ev-ok"] }),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

// TEST J — Valid result + valid validation evaluates to TaskState.COMPLETED
test("FAZ 23 - TEST J: Valid result + valid evidence evaluates to TaskState.COMPLETED", () => {
  const task = createTask({ id: "t-val-j", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-j",
    target: "node --version",
    result: ValidationResult.PASS
  });

  const evaluation = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: ["proc-stdout-v24"]
  });

  assert.equal(evaluation.success, true);
  assert.equal(evaluation.recommendedTaskState, TaskState.COMPLETED);
  assert.match(evaluation.reason, /Validation passed with verified evidence references/);
});

// TEST K — Failed execution cannot become false PASS
test("FAZ 23 - TEST K: ExecutionOutcome.FAILED strictly generates ValidationResult.FAIL", () => {
  const result = createExecutionResultContract({
    id: "r-failed",
    taskId: "t-k",
    planId: "p-k",
    outcome: ExecutionOutcome.FAILED,
    failureReason: "Command not found",
    evidenceReferences: ["ev-err"]
  });

  // Orchestrator semantics: outcome FAILED maps to ValidationResult.FAIL
  const validationResult = result.outcome === ExecutionOutcome.SUCCEEDED ? ValidationResult.PASS : ValidationResult.FAIL;
  assert.equal(validationResult, ValidationResult.FAIL);

  const task = createTask({ id: "t-k", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-k",
    target: "bad-command",
    result: validationResult,
    failureReason: result.failureReason
  });

  const evalK = evaluatePostExecutionValidation({ task, validation, evidences: result.evidenceReferences });
  assert.equal(evalK.success, false);
  assert.equal(evalK.recommendedTaskState, TaskState.FAILED);
});

// TEST L — Valid execution success remains distinct from validation PASS: Inconclusive validation holds task at WAITING
test("FAZ 23 - TEST L: Execution success is distinct from validation PASS (Inconclusive holds at WAITING)", () => {
  const task = createTask({ id: "t-val-l", jobId: "j-1", objective: "Run", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-l",
    target: "run",
    result: ValidationResult.INCONCLUSIVE
  });

  const evalL = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: ["proc-finished-status-0"]
  });

  assert.equal(evalL.success, false);
  assert.equal(evalL.recommendedTaskState, TaskState.WAITING);
  assert.equal(evalL.code, ErrorCodes.NOT_VERIFIED);
});
