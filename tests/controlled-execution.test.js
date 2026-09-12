/**
 * AI Development OS - Controlled Execution Boundary Test Suite
 * Validates Phase 11 & Phase 11.1 First Real Execution Boundary with Security Context Binding
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ErrorCodes,
  AdmissionDecision,
  AuthorizationDecision,
  ExecutionOutcome,
  createAdmissionResultContract,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  createExecutionAuthorizationContract,
  authorizeExecutionRequest,
  executeAuthorizedRequest
} from "../src/index.js";

function buildValidAuthorizedChain({ command = "node -e \"process.exit(0)\"", workingDirectory = process.cwd() } = {}) {
  const admission = createAdmissionResultContract({
    id: "adm-11-valid",
    taskId: "task-11",
    planId: "plan-11",
    decision: AdmissionDecision.ALLOWED,
    reason: "Preflight passed"
  });

  const handoff = createExecutionHandoffContract({
    id: "h-11-valid",
    taskId: "task-11",
    planId: "plan-11",
    admissionResult: admission,
    workingDirectory,
    expectedCommands: [command]
  });

  const request = consumeExecutionHandoff({
    requestId: "req-11-valid",
    handoff,
    admissionResult: admission
  });

  const authorization = authorizeExecutionRequest({
    id: "auth-11-valid",
    executionRequest: request,
    admissionResult: admission
  });

  return { admission, handoff, request, authorization };
}

test("TEST A: Authorized Request Executes (Real Process Execution)", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(0)\"" });

  const result = executeAuthorizedRequest({
    resultId: "res-real-1",
    executionRequest: request,
    authorization
  });

  assert.equal(result.id, "res-real-1");
  assert.equal(result.taskId, "task-11");
  assert.equal(result.planId, "plan-11");
  assert.equal(result.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(result.metadata.exitCode, 0);
});

test("TEST B: Denied Authorization Never Executes (Gate Enforcement)", () => {
  const { request } = buildValidAuthorizedChain();

  const deniedAuth = createExecutionAuthorizationContract({
    id: "auth-denied",
    requestId: request.id,
    taskId: request.taskId,
    planId: request.planId,
    admissionId: request.admissionId,
    handoffId: request.handoffId,
    decision: AuthorizationDecision.DENIED,
    reason: "Denied by policy"
  });

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-err",
      executionRequest: request,
      authorization: deniedAuth,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launch must occur when authorization is DENIED");
});

test("TEST C: Missing Authorization Never Executes", () => {
  const { request } = buildValidAuthorizedChain();

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-missing-auth",
      executionRequest: request,
      authorization: null,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launch must occur when authorization is missing");
});

test("TEST D: Identity Mismatch Never Executes", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  // Forged request with mismatched id
  const forgedRequest = { ...request, id: "req-mismatch" };

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-id-mis",
      executionRequest: forgedRequest,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(launchCount, 0, "No process launch must occur when identity mismatches");
});

test("TEST E: Approved Working Directory Is Used", () => {
  const targetDir = process.cwd();
  const { request, authorization } = buildValidAuthorizedChain({ workingDirectory: targetDir });

  let capturedCwd = null;
  const mockRunner = (exec, args, options) => {
    capturedCwd = options.cwd;
    return { status: 0 };
  };

  executeAuthorizedRequest({
    resultId: "res-cwd",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(capturedCwd, targetDir);
});

test("TEST F: Approved Command Is Executed (No alteration)", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node --version" });

  let capturedExecutable = null;
  let capturedArgs = null;
  const mockRunner = (exec, args) => {
    capturedExecutable = exec;
    capturedArgs = args;
    return { status: 0 };
  };

  executeAuthorizedRequest({
    resultId: "res-cmd",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(capturedExecutable, "node");
  assert.deepEqual(capturedArgs, ["--version"]);
});

test("TEST G: Non-Zero Process Exit Produces FAILED outcome (Real Process)", () => {
  // Real node invocation exiting with 42
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(42)\"" });

  const result = executeAuthorizedRequest({
    resultId: "res-fail-real",
    executionRequest: request,
    authorization
  });

  assert.equal(result.outcome, ExecutionOutcome.FAILED);
  assert.equal(result.metadata.exitCode, 42);
  assert.match(result.failureReason, /non-zero status code: 42/);
});

test("TEST H: Zero Exit Produces SUCCEEDED outcome (Real Process)", () => {
  // Real node invocation exiting with 0
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(0)\"" });

  const result = executeAuthorizedRequest({
    resultId: "res-success-real",
    executionRequest: request,
    authorization
  });

  assert.equal(result.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(result.metadata.exitCode, 0);
});

test("TEST I: No Retry (Exactly one attempt made)", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  let attempts = 0;
  const mockRunner = () => {
    attempts++;
    return { status: 1 }; // fail
  };

  const result = executeAuthorizedRequest({
    resultId: "res-one-attempt",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(attempts, 1, "Exactly one process attempt must be performed");
  assert.equal(result.outcome, ExecutionOutcome.FAILED);
});

test("TEST J: No Shell Requirement (shell: false explicitly enforced)", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  let capturedShellOption = null;
  const mockRunner = (exec, args, options) => {
    capturedShellOption = options.shell;
    return { status: 0 };
  };

  executeAuthorizedRequest({
    resultId: "res-no-shell",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(capturedShellOption, false);
});

test("TEST K: Result Is Declarative (Conforms to createExecutionResultContract)", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  const result = executeAuthorizedRequest({
    resultId: "res-decl",
    executionRequest: request,
    authorization
  });

  assert.equal(typeof result.id, "string");
  assert.equal(typeof result.taskId, "string");
  assert.equal(typeof result.planId, "string");
  assert.ok(Array.isArray(result.evidenceReferences));
  assert.equal(result.run, undefined);
  assert.equal(result.execute, undefined);
});

test("TEST L: Authorization / Result Separation", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  const result = executeAuthorizedRequest({
    resultId: "res-sep-11",
    executionRequest: request,
    authorization
  });

  assert.equal(authorization.decision, AuthorizationDecision.AUTHORIZED);
  assert.equal(result.outcome, ExecutionOutcome.SUCCEEDED);
  assert.equal(authorization.outcome, undefined);
  assert.equal(result.decision, undefined);
});

test("TEST M: Immutability (Execution Result cannot be mutated)", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  const result = executeAuthorizedRequest({
    resultId: "res-imm-11",
    executionRequest: request,
    authorization
  });

  assert.throws(() => { result.outcome = ExecutionOutcome.FAILED; }, TypeError);
  assert.throws(() => { result.metadata = {}; }, TypeError);
});

test("TEST N: Determinism (Same inputs -> Same outcome)", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(0)\"" });

  const r1 = executeAuthorizedRequest({ resultId: "res-det-1", executionRequest: request, authorization });
  const r2 = executeAuthorizedRequest({ resultId: "res-det-1", executionRequest: request, authorization });

  assert.deepEqual(r1, r2);
});

/* ========================================================================= */
/* FAZ 11.1 SECURITY REMEDIATION TESTS: AUTHORIZED EXECUTION CONTEXT BINDING */
/* ========================================================================= */

test("FAZ 11.1 MANDATORY SECURITY REGRESSION: Forged ExecutionRequest with same IDs but altered command is BLOCKED", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node -e \"process.exit(0)\"" });

  // Forged ExecutionRequest keeping ALL identity IDs intact, but altering the handoff expectedCommands
  const forgedHandoff = {
    ...request.handoffReference,
    expectedCommands: ["node -e \"console.log('malicious injected command')\""]
  };

  const forgedRequest = {
    ...request,
    handoffReference: forgedHandoff
  };

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-exploit-cmd",
      executionRequest: forgedRequest,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "Security Blocker: No process launch must occur when command is forged");
});

test("FAZ 11.1 MANDATORY SECURITY REGRESSION: Forged ExecutionRequest with same IDs but altered workingDirectory is BLOCKED", () => {
  const { request, authorization } = buildValidAuthorizedChain({ workingDirectory: process.cwd() });

  // Forged ExecutionRequest keeping ALL identity IDs intact, but altering workingDirectory
  const forgedHandoff = {
    ...request.handoffReference,
    workingDirectory: "C:\\forbidden\\path"
  };

  const forgedRequest = {
    ...request,
    handoffReference: forgedHandoff
  };

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-exploit-cwd",
      executionRequest: forgedRequest,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "Security Blocker: No process launch must occur when working directory is forged");
});

test("FAZ 11.1 NEGATIVE TEST: Missing or empty approved workingDirectory is BLOCKED (no implicit fallback)", () => {
  const { request, authorization } = buildValidAuthorizedChain();

  // Forged ExecutionRequest with missing/empty workingDirectory
  const forgedHandoff = {
    ...request.handoffReference,
    workingDirectory: ""
  };

  const forgedRequest = {
    ...request,
    handoffReference: forgedHandoff
  };

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-missing-cwd",
      executionRequest: forgedRequest,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launch must occur when workingDirectory is empty/missing");
});

test("FAZ 11.1 NEGATIVE TEST: Authorization missing authorizedContext is BLOCKED", () => {
  const { request } = buildValidAuthorizedChain();

  // Bare authorization object without bound authorizedContext
  const bareAuth = createExecutionAuthorizationContract({
    id: "auth-bare",
    requestId: request.id,
    taskId: request.taskId,
    planId: request.planId,
    admissionId: request.admissionId,
    handoffId: request.handoffId,
    decision: AuthorizationDecision.AUTHORIZED,
    reason: "Valid without context",
    authorizedContext: null
  });

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-no-ctx",
      executionRequest: request,
      authorization: bareAuth,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launch must occur when authorization lacks authorizedContext");
});

test("FAZ 11.1 POSITIVE REGRESSION: Valid authorized context executes with exactly 1 launch", () => {
  const { request, authorization } = buildValidAuthorizedChain({ command: "node --version" });

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const result = executeAuthorizedRequest({
    resultId: "res-valid-ctx",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(launchCount, 1, "Exactly 1 process launch must occur for valid authorized context");
  assert.equal(result.outcome, ExecutionOutcome.SUCCEEDED);
});
