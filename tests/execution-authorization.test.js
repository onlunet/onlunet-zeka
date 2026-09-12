/**
 * AI Development OS - Final Execution Authorization Boundary Contract Test Suite
 * Validates Phase 10 Final Execution Authorization Foundation (Tests A through M)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  AdmissionDecision,
  AuthorizationDecision,
  createAdmissionResultContract,
  createExecutionHandoffContract,
  createExecutionRequestContract,
  consumeExecutionHandoff,
  createExecutionAuthorizationContract,
  authorizeExecutionRequest,
  createExecutionResultContract,
  ExecutionOutcome
} from "../src/index.js";

function createValidChainFixtures() {
  const admission = createAdmissionResultContract({
    id: "adm-10-valid",
    taskId: "task-10",
    planId: "plan-10",
    decision: AdmissionDecision.ALLOWED,
    reason: "Admission approved"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-10-valid",
    taskId: "task-10",
    planId: "plan-10",
    admissionResult: admission
  });

  const request = consumeExecutionHandoff({
    requestId: "req-10-valid",
    handoff,
    admissionResult: admission
  });

  return { admission, handoff, request };
}

test("TEST A: Valid Authorization with ALLOWED admission & consistent identity chain", () => {
  const { admission, request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({
    id: "auth-01",
    executionRequest: request,
    admissionResult: admission
  });

  assert.equal(auth.id, "auth-01");
  assert.equal(auth.requestId, "req-10-valid");
  assert.equal(auth.taskId, "task-10");
  assert.equal(auth.planId, "plan-10");
  assert.equal(auth.admissionId, "adm-10-valid");
  assert.equal(auth.handoffId, "h-10-valid");
  assert.equal(auth.decision, AuthorizationDecision.AUTHORIZED);
  assert.equal(auth.code, null);
});

test("TEST B: DENIED Admission results in DENIED authorization", () => {
  const deniedAdmission = createAdmissionResultContract({
    id: "adm-denied-10",
    taskId: "task-10",
    planId: "plan-10",
    decision: AdmissionDecision.DENIED,
    reason: "Security policy denial"
  });

  const { request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({
    id: "auth-denied",
    executionRequest: request,
    admissionResult: deniedAdmission
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.SECURITY_BLOCKED);
});

test("TEST C: Missing Admission results in DENIED authorization", () => {
  const { request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({
    id: "auth-missing-adm",
    executionRequest: request,
    admissionResult: null
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.SECURITY_BLOCKED);
});

test("TEST D: Task Identity Mismatch results in DENIED authorization", () => {
  const { admission, handoff } = createValidChainFixtures();

  // Forged request with mismatched taskId
  const forgedRequest = createExecutionRequestContract({
    id: "req-mismatch-task",
    taskId: "task-10", // must match handoff internally to construct
    planId: "plan-10",
    admissionId: "adm-10-valid",
    handoffId: "h-10-valid",
    handoffReference: handoff
  });

  // Admission with different taskId
  const mismatchedAdmission = createAdmissionResultContract({
    id: "adm-10-valid",
    taskId: "task-mismatched",
    planId: "plan-10",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const auth = authorizeExecutionRequest({
    id: "auth-task-mis",
    executionRequest: forgedRequest,
    admissionResult: mismatchedAdmission
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.INVALID_CONTRACT);
});

test("TEST E: Plan Identity Mismatch results in DENIED authorization", () => {
  const { handoff } = createValidChainFixtures();

  const request = createExecutionRequestContract({
    id: "req-plan-mis",
    taskId: "task-10",
    planId: "plan-10",
    admissionId: "adm-10-valid",
    handoffId: "h-10-valid",
    handoffReference: handoff
  });

  const mismatchedAdmission = createAdmissionResultContract({
    id: "adm-10-valid",
    taskId: "task-10",
    planId: "plan-other",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const auth = authorizeExecutionRequest({
    id: "auth-plan-mis",
    executionRequest: request,
    admissionResult: mismatchedAdmission
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.INVALID_CONTRACT);
});

test("TEST F: Admission Identity Mismatch results in DENIED authorization", () => {
  const { handoff } = createValidChainFixtures();

  const request = createExecutionRequestContract({
    id: "req-adm-mis",
    taskId: "task-10",
    planId: "plan-10",
    admissionId: "adm-10-valid",
    handoffId: "h-10-valid",
    handoffReference: handoff
  });

  const differentAdmission = createAdmissionResultContract({
    id: "adm-different-id",
    taskId: "task-10",
    planId: "plan-10",
    decision: AdmissionDecision.ALLOWED,
    reason: "OK"
  });

  const auth = authorizeExecutionRequest({
    id: "auth-adm-mis",
    executionRequest: request,
    admissionResult: differentAdmission
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.INVALID_CONTRACT);
});

test("TEST G: Handoff Identity Mismatch results in DENIED authorization", () => {
  const { admission } = createValidChainFixtures();

  // Forged request object where handoffReference id does not match request handoffId
  const forgedRequest = Object.freeze({
    id: "req-forged",
    taskId: "task-10",
    planId: "plan-10",
    admissionId: "adm-10-valid",
    handoffId: "h-expected",
    handoffReference: Object.freeze({
      id: "h-mismatch",
      taskId: "task-10",
      planId: "plan-10",
      admissionId: "adm-10-valid"
    })
  });

  const auth = authorizeExecutionRequest({
    id: "auth-h-mis",
    executionRequest: forgedRequest,
    admissionResult: admission
  });

  assert.equal(auth.decision, AuthorizationDecision.DENIED);
  assert.equal(auth.code, ErrorCodes.INVALID_CONTRACT);
});

test("TEST H: Request Identity Mismatch validation rejects invalid contract", () => {
  assert.throws(
    () => createExecutionAuthorizationContract({
      id: "",
      requestId: "req-1",
      taskId: "t-1",
      planId: "p-1",
      admissionId: "a-1",
      handoffId: "h-1",
      decision: "AUTHORIZED",
      reason: "ok"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.throws(
    () => createExecutionAuthorizationContract({
      id: "auth-1",
      requestId: "",
      taskId: "t-1",
      planId: "p-1",
      admissionId: "a-1",
      handoffId: "h-1",
      decision: "AUTHORIZED",
      reason: "ok"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

test("TEST I: Immutability (Authorization cannot be mutated)", () => {
  const { admission, request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({
    id: "auth-imm",
    executionRequest: request,
    admissionResult: admission
  });

  assert.throws(() => { auth.decision = AuthorizationDecision.DENIED; }, TypeError);
  assert.throws(() => { auth.taskId = "task-mutated"; }, TypeError);
  assert.throws(() => { auth.requestId = "req-mutated"; }, TypeError);
});

test("TEST J: Determinism (Same inputs -> Same authorization decision)", () => {
  const { admission, request } = createValidChainFixtures();

  const auth1 = authorizeExecutionRequest({ id: "auth-det", executionRequest: request, admissionResult: admission });
  const auth2 = authorizeExecutionRequest({ id: "auth-det", executionRequest: request, admissionResult: admission });

  assert.deepEqual(auth1, auth2);
});

test("TEST K: No Executable Methods Exposed on Authorization Contract", () => {
  const { admission, request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({ id: "auth-pure", executionRequest: request, admissionResult: admission });

  assert.equal(auth.run, undefined);
  assert.equal(auth.execute, undefined);
  assert.equal(auth.spawn, undefined);
  assert.equal(auth.dispatch, undefined);
  assert.equal(auth.queue, undefined);
  assert.equal(auth.schedule, undefined);
  assert.equal(auth.retry, undefined);
  assert.equal(auth.cancel, undefined);
  assert.equal(auth.shell, undefined);
  assert.equal(auth.fork, undefined);
  assert.equal(auth.start, undefined);
});

test("TEST L: Invariant Distinction (Authorization != Execution Result)", () => {
  const { admission, request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({ id: "auth-diff", executionRequest: request, admissionResult: admission });

  // Authorization must NOT have execution-result fields
  assert.equal(auth.outcome, undefined);
  assert.equal(auth.exitCode, undefined);
  assert.equal(auth.stdout, undefined);
  assert.equal(auth.stderr, undefined);
  assert.equal(auth.pid, undefined);
  assert.equal(auth.processId, undefined);
  assert.equal(auth.duration, undefined);
  assert.equal(auth.startedAt, undefined);
  assert.equal(auth.completedAt, undefined);

  // ExecutionResult carries outcome
  const execResult = createExecutionResultContract({
    id: "res-diff",
    taskId: "task-10",
    planId: "plan-10",
    outcome: ExecutionOutcome.SUCCEEDED
  });
  assert.equal(execResult.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(execResult.decision, undefined);
});

test("TEST M: No Bypass (DENIED or Mismatched cannot be transformed into AUTHORIZED)", () => {
  const deniedAdmission = createAdmissionResultContract({
    id: "adm-denied-m",
    taskId: "task-10",
    planId: "plan-10",
    decision: AdmissionDecision.DENIED,
    reason: "Denied by preflight"
  });
  const { request } = createValidChainFixtures();

  const auth = authorizeExecutionRequest({
    id: "auth-m-check",
    executionRequest: request,
    admissionResult: deniedAdmission
  });

  assert.notEqual(auth.decision, AuthorizationDecision.AUTHORIZED);
  assert.equal(auth.decision, AuthorizationDecision.DENIED);
});
