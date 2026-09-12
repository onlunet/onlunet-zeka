/**
 * AI Development OS - Execution Handoff / Runtime Contract Test Suite
 * Validates Phase 8 Execution Handoff Foundation
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  AdmissionDecision,
  createAdmissionResultContract,
  createExecutionHandoffContract,
  createExecutionResultContract,
  ExecutionOutcome
} from "../src/index.js";

test("FAZ 8 - 1: Valid ExecutionHandoffContract construction & immutability", () => {
  const admission = createAdmissionResultContract({
    id: "adm-101",
    taskId: "task-101",
    planId: "plan-101",
    decision: AdmissionDecision.ALLOWED,
    reason: "Admission approved"
  });

  const handoff = createExecutionHandoffContract({
    id: "handoff-101",
    taskId: "task-101",
    planId: "plan-101",
    admissionResult: admission,
    workingDirectory: "d:/project",
    expectedCommands: ["npm test"],
    policyReferences: ["scope-pol-1", "exec-pol-1"],
    executionBoundaryReference: "boundary-root",
    scopeReference: "scope-root"
  });

  assert.equal(handoff.id, "handoff-101");
  assert.equal(handoff.taskId, "task-101");
  assert.equal(handoff.planId, "plan-101");
  assert.equal(handoff.admissionId, "adm-101");
  assert.equal(handoff.workingDirectory, "d:/project");
  assert.deepEqual(handoff.expectedCommands, ["npm test"]);
  assert.deepEqual(handoff.policyReferences, ["scope-pol-1", "exec-pol-1"]);
  assert.equal(handoff.executionBoundaryReference, "boundary-root");
  assert.equal(handoff.scopeReference, "scope-root");

  // Immutability tests
  assert.throws(() => { handoff.id = "h-mutated"; }, TypeError);
  assert.throws(() => { handoff.expectedCommands.push("rm -rf /"); }, TypeError);
  assert.throws(() => { handoff.policyReferences.push("bad-pol"); }, TypeError);
});

test("FAZ 8 - 2: Missing required identity fields rejection", () => {
  const admission = createAdmissionResultContract({
    id: "adm-102",
    taskId: "task-102",
    planId: "plan-102",
    decision: AdmissionDecision.ALLOWED,
    reason: "Admission approved"
  });

  assert.throws(() => createExecutionHandoffContract({ id: "", taskId: "task-102", planId: "plan-102", admissionResult: admission }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionHandoffContract({ id: "h-1", taskId: "", planId: "plan-102", admissionResult: admission }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionHandoffContract({ id: "h-1", taskId: "task-102", planId: "", admissionResult: admission }), new RegExp(ErrorCodes.INVALID_CONTRACT));
  assert.throws(() => createExecutionHandoffContract({ id: "h-1", taskId: "task-102", planId: "plan-102", admissionResult: null }), new RegExp(ErrorCodes.INVALID_CONTRACT));
});

test("FAZ 8 - 3: Admission DENIED rejection (Strict Gate)", () => {
  const deniedAdmission = createAdmissionResultContract({
    id: "adm-denied",
    taskId: "task-denied",
    planId: "plan-denied",
    decision: AdmissionDecision.DENIED,
    reason: "Policy blocked execution"
  });

  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-denied",
      taskId: "task-denied",
      planId: "plan-denied",
      admissionResult: deniedAdmission
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

test("FAZ 8 - 4: Identity mismatch rejection between Admission and Handoff", () => {
  const admission = createAdmissionResultContract({
    id: "adm-mismatch",
    taskId: "task-A",
    planId: "plan-A",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  // Mismatched taskId
  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-mis-1",
      taskId: "task-B",
      planId: "plan-A",
      admissionResult: admission
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // Mismatched planId
  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-mis-2",
      taskId: "task-A",
      planId: "plan-B",
      admissionResult: admission
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

test("FAZ 8 - 5: Invariant separation (Handoff != Execution Result)", () => {
  const admission = createAdmissionResultContract({
    id: "adm-103",
    taskId: "task-103",
    planId: "plan-103",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-103",
    taskId: "task-103",
    planId: "plan-103",
    admissionResult: admission
  });

  // Handoff must not carry execution outcomes (SUCCEEDED/FAILED/exitCode)
  assert.equal(handoff.outcome, undefined);
  assert.equal(handoff.exitCode, undefined);
  assert.equal(handoff.stdout, undefined);
  assert.equal(handoff.stderr, undefined);

  // ExecutionResult carries outcome
  const execResult = createExecutionResultContract({
    id: "res-103",
    taskId: "task-103",
    planId: "plan-103",
    outcome: ExecutionOutcome.SUCCEEDED
  });
  assert.equal(execResult.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(execResult.admissionId, undefined);
});

test("FAZ 8 - 6: Determinism & Negative Security Tests (No executable / transport methods)", () => {
  const admission = createAdmissionResultContract({
    id: "adm-det",
    taskId: "t-det",
    planId: "p-det",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const h1 = createExecutionHandoffContract({ id: "h-det", taskId: "t-det", planId: "p-det", admissionResult: admission });
  const h2 = createExecutionHandoffContract({ id: "h-det", taskId: "t-det", planId: "p-det", admissionResult: admission });

  assert.deepEqual(h1, h2);

  // Negative security tests: zero executable/transport methods
  assert.equal(h1.run, undefined);
  assert.equal(h1.execute, undefined);
  assert.equal(h1.dispatch, undefined);
  assert.equal(h1.spawn, undefined);
  assert.equal(h1.fork, undefined);
  assert.equal(h1.queue, undefined);
  assert.equal(h1.schedule, undefined);
  assert.equal(h1.shell, undefined);
  assert.equal(h1.submit, undefined);
});
