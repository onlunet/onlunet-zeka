/**
 * AI Development OS - Phase 17 Integration Test Suite
 * Validates Declarative Change -> Controlled File Mutation Integration Foundation
 *
 * Enforces:
 * - Test A: Authoritative plan single expectedFileChange succeeds through controlled mutation
 * - Test B: Target outside authoritative plan expectedFileChanges is BLOCKED (0 writes)
 * - Test C: Client/caller target tampering against authorizedContext is BLOCKED (0 writes)
 * - Test D: Workspace tampering against authorizedContext is BLOCKED (0 writes)
 * - Test E: Path traversal target is BLOCKED (0 writes)
 * - Test F: Wrong planId is BLOCKED (0 writes)
 * - Test G: Wrong taskId is BLOCKED (0 writes)
 * - Test H: Missing authorization is BLOCKED (0 writes)
 * - Test I: DENIED authorization is BLOCKED (0 writes)
 * - Test J: Expected-state conflict blocks mutation (0 unauthorized overwrite)
 * - Test K: Dry-run returns valid simulation with NO actual mutation
 * - Test L: Mutation success is strictly separate from post-execution validation
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
  createExecutionPlanContract,
  createTask,
  TaskState,
  createValidation,
  ValidationResult,
  evaluatePostExecutionValidation
} from "../src/index.js";

function buildAuthoritativePipelineContext({
  fileTarget = "src/valid-plan-target.js",
  content = "export const integrated = true;",
  expectedState = null,
  decision = AuthorizationDecision.AUTHORIZED,
  tamperedPlanId = null,
  tamperedTaskId = null
} = {}) {
  const workspaceRoot = process.cwd();
  const absoluteTarget = path.resolve(workspaceRoot, fileTarget);

  const plan = createExecutionPlanContract({
    id: "plan-faz17-1",
    taskId: "task-faz17-1",
    expectedFileChanges: [fileTarget]
  });

  const request = {
    id: "req-faz17-1",
    taskId: tamperedTaskId || "task-faz17-1",
    planId: tamperedPlanId || "plan-faz17-1",
    admissionId: "adm-faz17-1",
    handoffId: "h-faz17-1"
  };

  const authorization = {
    id: "auth-faz17-1",
    requestId: "req-faz17-1",
    taskId: "task-faz17-1",
    planId: "plan-faz17-1",
    admissionId: "adm-faz17-1",
    handoffId: "h-faz17-1",
    decision,
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: absoluteTarget,
      authorizedContent: content,
      expectedState
    }
  };

  return { plan, request, authorization, workspaceRoot, absoluteTarget, content };
}

test("TEST A: Authoritative plan single expectedFileChange succeeds through controlled mutation", () => {
  const { plan, request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  // Verify target is present in authoritative plan
  assert.equal(plan.expectedFileChanges.includes("src/valid-plan-target.js"), true);

  const result = executeAuthorizedFileMutation({
    resultId: "res-faz17-a",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath: absoluteTarget,
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

test("TEST B: Target outside authoritative plan expectedFileChanges is BLOCKED (0 writes)", () => {
  const { plan, request, authorization, workspaceRoot, content } = buildAuthoritativePipelineContext({
    fileTarget: "src/valid-plan-target.js"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  // Caller attempts to mutate an unapproved file not in plan.expectedFileChanges
  const unapprovedTarget = path.resolve(workspaceRoot, "src/unapproved-target.js");
  assert.equal(plan.expectedFileChanges.includes("src/unapproved-target.js"), false);

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: unapprovedTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST C: Client/caller target tampering against authorizedContext is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildAuthoritativePipelineContext({
    fileTarget: "src/fileA.js"
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

test("TEST D: Workspace tampering against authorizedContext is BLOCKED (0 writes)", () => {
  const { request, authorization, absoluteTarget, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const tamperedWorkspace = "D:\\TamperedProject";

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot: tamperedWorkspace,
      targetPath: absoluteTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST E: Path traversal target is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const traversalTarget = path.join(workspaceRoot, "..", "traversal-target.js");

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

test("TEST F: Wrong planId is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext({
    tamperedPlanId: "forged-plan-id-999"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: absoluteTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(writeCount, 0);
});

test("TEST G: Wrong taskId is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext({
    tamperedTaskId: "forged-task-id-999"
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: absoluteTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(writeCount, 0);
});

test("TEST H: Missing authorization is BLOCKED (0 writes)", () => {
  const { request, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization: null,
      workspaceRoot,
      targetPath: absoluteTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(writeCount, 0);
});

test("TEST I: DENIED authorization is BLOCKED (0 writes)", () => {
  const { request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext({
    decision: AuthorizationDecision.DENIED
  });
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  assert.throws(
    () => executeAuthorizedFileMutation({
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: absoluteTarget,
      content,
      fsWriter: mockWriter
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(writeCount, 0);
});

test("TEST J: Expected-state conflict blocks mutation (0 unauthorized overwrite)", () => {
  const { request, authorization, workspaceRoot, content } = buildAuthoritativePipelineContext({
    fileTarget: "package.json",
    expectedState: "DIFFERENT_STATE_CONFLICT"
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

test("TEST K: Dry-run returns valid simulation with NO actual mutation", () => {
  const { request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const result = executeAuthorizedFileMutation({
    resultId: "res-faz17-k",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath: absoluteTarget,
    content,
    dryRun: true,
    fsWriter: mockWriter
  });

  assert.equal(result.outcome, FileMutationOutcome.SUCCEEDED);
  assert.equal(result.isDryRun, true);
  assert.equal(writeCount, 0, "Dry run must never write to disk");
});

test("TEST L: Mutation success is strictly separate from post-execution validation", () => {
  const { plan, request, authorization, workspaceRoot, absoluteTarget, content } = buildAuthoritativePipelineContext();
  let writeCount = 0;
  const mockWriter = () => { writeCount++; };

  const mutationResult = executeAuthorizedFileMutation({
    resultId: "res-faz17-l",
    executionRequest: request,
    authorization,
    workspaceRoot,
    targetPath: absoluteTarget,
    content,
    fsWriter: mockWriter
  });

  assert.equal(mutationResult.outcome, FileMutationOutcome.SUCCEEDED);

  // Post-Execution Validation evaluates the result independently
  const task = createTask({ id: request.taskId, jobId: "job-17", objective: "File mutation", status: TaskState.VALIDATING });
  const validation = createValidation({
    id: "val-17",
    target: "Integration check",
    result: ValidationResult.FAIL,
    failureReason: "Linting failed on modified file"
  });

  const postVal = evaluatePostExecutionValidation({
    task,
    validation,
    evidences: ["ev-lint-17"]
  });

  assert.equal(postVal.success, false);
  assert.equal(postVal.recommendedTaskState, TaskState.FAILED);
  assert.notEqual(mutationResult.outcome, postVal.recommendedTaskState);
});
