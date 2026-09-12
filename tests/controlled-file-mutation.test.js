/**
 * AI Development OS - Controlled File Mutation Test Suite
 * Validates Phase 16 & Phase 16.1 Controlled File Mutation Boundary Foundation & Integrity Remediation
 *
 * Enforces:
 * - Test 1: Valid Authorized WRITE succeeds (boundary & mock test)
 * - Test 2: Valid Authorized DELETE succeeds (boundary & actual disk lifecycle test)
 * - Test 3: Missing authorization is BLOCKED (0 writes)
 * - Test 4: Denied authorization is BLOCKED (0 writes)
 * - Test 5: Target path tampering against authorizedContext is BLOCKED (0 writes)
 * - Test 6: Workspace tampering against authorizedContext is BLOCKED (0 writes)
 * - Test 7: Path traversal target is BLOCKED (0 writes)
 * - Test 8: Outside workspace absolute path is BLOCKED (0 writes)
 * - Test 9: Expected state conflict is BLOCKED (0 writes)
 * - Test 10: Filesystem READ_ERROR strictly blocks mutation (0 writes)
 * - Test 11: Payload tampering is BLOCKED (0 writes)
 * - Test 12: Dry run mode simulates success with 0 disk writes
 * - Test 13: Result identity matches request and authorization
 * - Test 14: Mutation outcome SUCCEEDED is strictly separate from post-execution validation
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

import {
  ErrorCodes,
  AuthorizationDecision,
  FileMutationOperation,
  FileMutationOutcome,
  executeAuthorizedFileMutation,
  createFileMutationResultContract,
  createValidation,
  ValidationResult,
  createTask,
  TaskState,
  evaluatePostExecutionValidation
} from "../src/index.js";

function buildValidMutationContext({
  target = "src/example.js",
  content = "export const x = 1;",
  operation = FileMutationOperation.WRITE,
  expectedState = null,
  decision = AuthorizationDecision.AUTHORIZED
} = {}) {
  const workspaceRoot = process.cwd();
  const targetPath = path.resolve(workspaceRoot, target);

  const request = {
    id: "req-mut-1",
    taskId: "task-mut-1",
    planId: "plan-mut-1",
    admissionId: "adm-mut-1",
    handoffId: "h-mut-1",
    handoffReference: {
      id: "h-mut-1",
      workingDirectory: workspaceRoot,
      expectedCommands: []
    }
  };

  const authorization = {
    id: "auth-mut-1",
    requestId: "req-mut-1",
    taskId: "task-mut-1",
    planId: "plan-mut-1",
    admissionId: "adm-mut-1",
    handoffId: "h-mut-1",
    decision,
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: targetPath,
      authorizedContent: content,
      expectedState
    }
  };

  return { request, authorization, workspaceRoot, targetPath, content, operation };
}

test("TEST 1: Valid Authorized WRITE succeeds with exact context binding", () => {
  const { request, authorization, workspaceRoot, targetPath, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const result = executeAuthorizedFileMutation({
    resultId: "mut-res-1",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath,
    content,
    operation: FileMutationOperation.WRITE,
    fsWriter: mockWriter
  });

  assert.equal(result.outcome, FileMutationOutcome.SUCCEEDED);
  assert.equal(result.isDryRun, false);
  assert.equal(result.taskId, request.taskId);
  assert.equal(result.planId, request.planId);
  assert.equal(writeCount, 1);
});

test("TEST 2: Valid Authorized DELETE succeeds (Issue A Remediation: Authentic removal)", () => {
  const workspaceRoot = process.cwd();
  const tempTarget = path.join(workspaceRoot, "tmp-faz16-delete-test.txt");

  // Create temporary file on disk for authentic deletion test
  fs.writeFileSync(tempTarget, "temp-to-delete", "utf-8");
  assert.equal(fs.existsSync(tempTarget), true);

  const { request, authorization } = buildValidMutationContext({
    target: "tmp-faz16-delete-test.txt",
    operation: FileMutationOperation.DELETE,
    expectedState: "temp-to-delete"
  });

  const result = executeAuthorizedFileMutation({
    resultId: "mut-res-del",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath: tempTarget,
    operation: FileMutationOperation.DELETE,
    expectedState: "temp-to-delete"
  });

  assert.equal(result.outcome, FileMutationOutcome.SUCCEEDED);
  assert.equal(result.metadata.operation, FileMutationOperation.DELETE);
  assert.equal(fs.existsSync(tempTarget), false, "File must be removed on disk");
});

test("TEST 3: Missing Authorization is BLOCKED (0 writes)", () => {
  const { request, workspaceRoot, targetPath, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization: null,
      workspaceRoot,
      targetPath,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(writeCount, 0);
});

test("TEST 4: Denied Authorization is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, targetPath, content } = buildValidMutationContext({
    decision: AuthorizationDecision.DENIED
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 5: Target Path Tampering against authorizedContext is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildValidMutationContext({
    target: "src/fileA.js"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const tamperedTarget = path.resolve(workspaceRoot, "src/fileB.js");

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: tamperedTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 6: Workspace Tampering against authorizedContext is BLOCKED (0 writes)", () => {
  const { request, authorization, targetPath, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const tamperedWorkspace = "D:\\AnotherProject";

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot: tamperedWorkspace,
      targetPath,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 7: Path Traversal target is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const traversalTarget = path.join(workspaceRoot, "..", "outside-escape.js");

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: traversalTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 8: Outside Workspace absolute path is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const outsideTarget = "C:\\Windows\\System32\\calc.exe";

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: outsideTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 9: Expected State Conflict is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildValidMutationContext({
    target: "package.json",
    expectedState: "NON_MATCHING_STATE_HASH"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: path.resolve(workspaceRoot, "package.json"),
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 10: Filesystem READ_ERROR strictly blocks mutation (Issue B Remediation)", () => {
  const workspaceRoot = process.cwd();
  // Pass a directory path as the targetPath: fs.existsSync is true, but readFileSync throws EISDIR
  const dirTarget = path.resolve(workspaceRoot, "src");

  const { request, authorization, content } = buildValidMutationContext({
    target: "src"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: dirTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0, "Read error must safely abort with 0 writes");
});

test("TEST 11: Payload Tampering is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, targetPath } = buildValidMutationContext({
    content: "AUTHORIZED_CONTENT"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath,
      content: "FORGED_MALICIOUS_CONTENT",
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST 12: Dry Run mode simulates success with 0 disk writes", () => {
  const { request, authorization, workspaceRoot, targetPath, content } = buildValidMutationContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const result = executeAuthorizedFileMutation({
    resultId: "mut-dry-1",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath,
    content,
    dryRun: true,
    fsWriter: mockWriter
  });

  assert.equal(result.outcome, FileMutationOutcome.SUCCEEDED);
  assert.equal(result.isDryRun, true);
  assert.equal(writeCount, 0, "Dry run must never write to disk");
});

test("TEST 13: Result Identity matches request and authorization", () => {
  const result = createFileMutationResultContract({
    id: "res-id-1",
    taskId: "t-id-1",
    planId: "p-id-1",
    targetPath: "src/index.js",
    outcome: FileMutationOutcome.SUCCEEDED
  });

  assert.equal(result.id, "res-id-1");
  assert.equal(result.taskId, "t-id-1");
  assert.equal(result.planId, "p-id-1");
  assert.equal(result.outcome, FileMutationOutcome.SUCCEEDED);

  assert.throws(() => { result.outcome = FileMutationOutcome.FAILED; }, TypeError);
});

test("TEST 14: Mutation outcome SUCCEEDED is strictly separate from post-execution validation", () => {
  const mutationResult = createFileMutationResultContract({
    id: "mut-succ-1",
    taskId: "task-test-14",
    planId: "plan-test-14",
    targetPath: "src/index.js",
    outcome: FileMutationOutcome.SUCCEEDED
  });
  assert.equal(mutationResult.outcome, FileMutationOutcome.SUCCEEDED);

  const task = createTask({ id: "task-test-14", jobId: "j-1", objective: "Mutate file", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-test-14",
    target: "Code linting",
    result: ValidationResult.FAIL,
    failureReason: "Syntax error in modified file"
  });

  const postVal = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: ["ev-lint-failed"]
  });

  assert.equal(postVal.success, false);
  assert.equal(postVal.recommendedTaskState, TaskState.FAILED);
  assert.notEqual(mutationResult.outcome, postVal.recommendedTaskState);
});
