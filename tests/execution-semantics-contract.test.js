/**
 * AI Development OS - Execution Semantics & Result Contract Test Suite
 * Validates Phase 6 Execution Semantics Foundation
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  ExecutionOutcome,
  createExecutionResultContract,
  createValidation,
  ValidationResult,
  TaskState,
  evaluatePostExecutionValidation
} from "../src/index.js";

test("FAZ 6 - 1: Valid ExecutionResultContract construction & immutability", () => {
  const result = createExecutionResultContract({
    id: "res-01",
    taskId: "task-101",
    planId: "plan-501",
    outcome: ExecutionOutcome.SUCCEEDED,
    evidenceReferences: ["ev-01", "ev-02"],
    metadata: { exitCode: 0 }
  });

  assert.equal(result.id, "res-01");
  assert.equal(result.taskId, "task-101");
  assert.equal(result.planId, "plan-501");
  assert.equal(result.outcome, ExecutionOutcome.SUCCEEDED);
  assert.deepEqual(result.evidenceReferences, ["ev-01", "ev-02"]);
  assert.equal(result.metadata.exitCode, 0);

  // Immutability test
  assert.throws(() => { result.outcome = ExecutionOutcome.FAILED; }, TypeError);
  assert.throws(() => { result.evidenceReferences.push("ev-leak"); }, TypeError);
});

test("FAZ 6 - 2: Missing required identity fields rejection", () => {
  assert.throws(() => createExecutionResultContract({ id: "", taskId: "t-1", planId: "p-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionResultContract({ id: "r-1", taskId: "", planId: "p-1" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionResultContract({ id: "r-1", taskId: "t-1", planId: "" }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("FAZ 6 - 3: Invalid outcome rejection (Zero State Invention)", () => {
  assert.throws(() => createExecutionResultContract({
    id: "r-1",
    taskId: "t-1",
    planId: "p-1",
    outcome: "RETRYING" // Forbidden invented state
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));

  assert.throws(() => createExecutionResultContract({
    id: "r-1",
    taskId: "t-1",
    planId: "p-1",
    outcome: "TIMEOUT" // Forbidden invented state
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("FAZ 6 - 4: Invalid evidenceReferences type rejection", () => {
  assert.throws(() => createExecutionResultContract({
    id: "r-1",
    taskId: "t-1",
    planId: "p-1",
    evidenceReferences: "not-an-array"
  }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("FAZ 6 - 5: Invariant separation (Execution Success != Validation Success)", () => {
  // An execution outcome may report SUCCEEDED
  const execResult = createExecutionResultContract({
    id: "res-02",
    taskId: "t-2",
    planId: "p-2",
    outcome: ExecutionOutcome.SUCCEEDED,
    evidenceReferences: ["ev-test-fail"]
  });
  assert.equal(execResult.outcome, ExecutionOutcome.SUCCEEDED);

  // But post-execution validation can still FAIL
  const task = { id: "t-2", status: TaskState.RUNNING };
  const validation = createValidation({
    id: "val-02",
    target: "Code linting",
    result: ValidationResult.FAIL,
    failureReason: "Lint errors detected"
  });

  const evalResult = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: execResult.evidenceReferences
  });

  // Task is marked FAILED despite execution outcome being SUCCEEDED
  assert.equal(evalResult.success, false);
  assert.equal(evalResult.recommendedTaskState, TaskState.FAILED);
});

test("FAZ 6 - 6: No executable methods exposed (Negative security test)", () => {
  const result = createExecutionResultContract({
    id: "res-pure",
    taskId: "t-1",
    planId: "p-1"
  });

  assert.equal(result.run, undefined);
  assert.equal(result.execute, undefined);
  assert.equal(result.dispatch, undefined);
  assert.equal(result.spawn, undefined);
  assert.equal(result.fork, undefined);
  assert.equal(result.queue, undefined);
});
