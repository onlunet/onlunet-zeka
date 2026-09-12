/**
 * AI Development OS - Runtime Consumption / Execution Engine Boundary Contract Test Suite
 * Validates Phase 9 Runtime Consumption Boundary Foundation
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  AdmissionDecision,
  createAdmissionResultContract,
  createExecutionHandoffContract,
  createExecutionRequestContract,
  consumeExecutionHandoff,
  createExecutionResultContract,
  ExecutionOutcome
} from "../src/index.js";

test("FAZ 9 - 1: Valid ExecutionRequestContract construction & immutability", () => {
  const admission = createAdmissionResultContract({
    id: "adm-901",
    taskId: "task-901",
    planId: "plan-901",
    decision: AdmissionDecision.ALLOWED,
    reason: "Admission approved"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-901",
    taskId: "task-901",
    planId: "plan-901",
    admissionResult: admission,
    expectedCommands: ["npm test"]
  });

  const request = createExecutionRequestContract({
    id: "req-901",
    taskId: "task-901",
    planId: "plan-901",
    admissionId: "adm-901",
    handoffId: "h-901",
    handoffReference: handoff
  });

  assert.equal(request.id, "req-901");
  assert.equal(request.taskId, "task-901");
  assert.equal(request.planId, "plan-901");
  assert.equal(request.admissionId, "adm-901");
  assert.equal(request.handoffId, "h-901");
  assert.equal(request.handoffReference.id, "h-901");

  // Immutability tests
  assert.throws(() => { request.id = "req-mutated"; }, TypeError);
  assert.throws(() => { request.taskId = "task-other"; }, TypeError);
});

test("FAZ 9 - 2: consumeExecutionHandoff produces valid ExecutionRequestContract", () => {
  const admission = createAdmissionResultContract({
    id: "adm-902",
    taskId: "task-902",
    planId: "plan-902",
    decision: AdmissionDecision.ALLOWED,
    reason: "Admission approved"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-902",
    taskId: "task-902",
    planId: "plan-902",
    admissionResult: admission
  });

  const req = consumeExecutionHandoff({
    requestId: "req-902",
    handoff,
    admissionResult: admission
  });

  assert.equal(req.id, "req-902");
  assert.equal(req.taskId, "task-902");
  assert.equal(req.planId, "plan-902");
  assert.equal(req.admissionId, "adm-902");
  assert.equal(req.handoffId, "h-902");
});

test("FAZ 9 - 3: Admission DENIED rejection at consumption gate (Strict Gate)", () => {
  const deniedAdmission = createAdmissionResultContract({
    id: "adm-denied-9",
    taskId: "task-denied-9",
    planId: "plan-denied-9",
    decision: AdmissionDecision.DENIED,
    reason: "Policy denial"
  });

  // Dummy handoff with forged admissionId to test consumer check
  const fakeHandoff = Object.freeze({
    id: "h-fake",
    taskId: "task-denied-9",
    planId: "plan-denied-9",
    admissionId: "adm-denied-9"
  });

  assert.throws(
    () => consumeExecutionHandoff({
      requestId: "req-denied",
      handoff: fakeHandoff,
      admissionResult: deniedAdmission
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

test("FAZ 9 - 4: Identity integrity chain verification (Task/Plan/Admission/Handoff)", () => {
  const admission = createAdmissionResultContract({
    id: "adm-chain",
    taskId: "task-chain",
    planId: "plan-chain",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-chain",
    taskId: "task-chain",
    planId: "plan-chain",
    admissionResult: admission
  });

  // Mismatched handoffId
  assert.throws(
    () => createExecutionRequestContract({
      id: "req-bad-1",
      taskId: "task-chain",
      planId: "plan-chain",
      admissionId: "adm-chain",
      handoffId: "h-mismatch",
      handoffReference: handoff
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // Mismatched taskId
  assert.throws(
    () => createExecutionRequestContract({
      id: "req-bad-2",
      taskId: "task-other",
      planId: "plan-chain",
      admissionId: "adm-chain",
      handoffId: "h-chain",
      handoffReference: handoff
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

test("FAZ 9 - 5: Invariant separation (Request != Execution Result)", () => {
  const admission = createAdmissionResultContract({
    id: "adm-sep",
    taskId: "task-sep",
    planId: "plan-sep",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-sep",
    taskId: "task-sep",
    planId: "plan-sep",
    admissionResult: admission
  });

  const request = consumeExecutionHandoff({
    requestId: "req-sep",
    handoff,
    admissionResult: admission
  });

  // Request MUST NOT carry execution outcome/runtime results
  assert.equal(request.outcome, undefined);
  assert.equal(request.exitCode, undefined);
  assert.equal(request.stdout, undefined);
  assert.equal(request.stderr, undefined);
  assert.equal(request.processId, undefined);

  // ExecutionResult carries outcome
  const execResult = createExecutionResultContract({
    id: "res-sep",
    taskId: "task-sep",
    planId: "plan-sep",
    outcome: ExecutionOutcome.SUCCEEDED
  });
  assert.equal(execResult.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(execResult.handoffId, undefined);
});

test("FAZ 9 - 6: Determinism & Negative Security Tests (No executable / transport methods)", () => {
  const admission = createAdmissionResultContract({
    id: "adm-det-9",
    taskId: "task-det-9",
    planId: "plan-det-9",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-det-9",
    taskId: "task-det-9",
    planId: "plan-det-9",
    admissionResult: admission
  });

  const req1 = consumeExecutionHandoff({ requestId: "req-det", handoff, admissionResult: admission });
  const req2 = consumeExecutionHandoff({ requestId: "req-det", handoff, admissionResult: admission });

  assert.deepEqual(req1, req2);

  // Negative security check: zero executable / transport methods on request
  assert.equal(req1.run, undefined);
  assert.equal(req1.execute, undefined);
  assert.equal(req1.dispatch, undefined);
  assert.equal(req1.spawn, undefined);
  assert.equal(req1.exec, undefined);
  assert.equal(req1.fork, undefined);
  assert.equal(req1.queue, undefined);
  assert.equal(req1.schedule, undefined);
  assert.equal(req1.retry, undefined);
  assert.equal(req1.cancel, undefined);
  assert.equal(req1.submit, undefined);
  assert.equal(req1.shell, undefined);
});
