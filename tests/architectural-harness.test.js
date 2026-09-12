/**
 * AI Development OS - Architectural Test Harness
 * Phase 1 Foundation & Phase 1.1 Hardened Contract Validation
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  ProjectState,
  JobState,
  TaskState,
  ApprovalState,
  ValidationResult,
  ScopeDecision,
  ChangeSurfaces,
  ErrorCodes,
  ValidProjectTransitions,
  ValidJobTransitions,
  ValidTaskTransitions,
  createProject,
  createRequirement,
  createBlueprint,
  createChangeIntent,
  createWorkflow,
  createJob,
  createTask,
  createAgent,
  createAIRequest,
  createProvider,
  createModel,
  createExecutionPlan,
  createEvidence,
  createValidation,
  createApproval,
  createCheckpoint,
  createStateTransition,
  validateStateTransition,
  createDecision,
  createAuditRecord,
  createProjectBrain,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy,
  createExecutionBoundaryInterface,
  isPathInsideDirectory,
  createProviderAdapterInterface,
  createAuditLedgerInterface
} from "../src/index.js";

// ==========================================
// PRESERVED ORIGINAL FAZ 1 TESTS (1 to 9)
// ==========================================

test("1. Domain Contracts Initialization & Immutability", () => {
  const project = createProject({ id: "p1", name: "AI Dev OS" });
  assert.equal(project.id, "p1");
  assert.equal(project.status, ProjectState.DISCOVERY);
  assert.throws(() => { project.name = "Mutated"; }, TypeError);

  const req = createRequirement({ id: "r1", projectId: "p1", description: "Local execution" });
  assert.equal(req.projectId, "p1");

  const bp = createBlueprint({ id: "b1", projectId: "p1", purpose: "Build OS" });
  assert.equal(bp.purpose, "Build OS");

  const changeIntent = createChangeIntent({
    id: "ci1",
    projectId: "p1",
    sourceRequirementId: "r1",
    blueprintReferenceId: "b1",
    objective: "Establish Foundation",
    allowedSurfaces: [ChangeSurfaces.FILES],
    forbiddenSurfaces: [ChangeSurfaces.INFRASTRUCTURE]
  });
  assert.equal(changeIntent.allowedSurfaces.includes(ChangeSurfaces.FILES), true);
  assert.equal(changeIntent.forbiddenSurfaces.includes(ChangeSurfaces.INFRASTRUCTURE), true);
});

test("2. State Machine Contracts & Invalid Transitions", () => {
  assert.throws(
    () => createProject({ id: "p2", name: "Bad State", status: "NON_EXISTENT_STATE" }),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  assert.throws(
    () => createJob({ id: "j1", projectId: "p1", workflowId: "w1", status: "FAKE_JOB_STATE" }),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  assert.throws(
    () => createTask({ id: "t1", jobId: "j1", objective: "Run", status: "UNKNOWN_TASK_STATUS" }),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

test("3. Scope Guard Contract & Surface Validation", () => {
  const policy = createScopePolicy({
    allowedSurfaces: [ChangeSurfaces.FILES, ChangeSurfaces.CONFIG],
    forbiddenSurfaces: [ChangeSurfaces.INFRASTRUCTURE, ChangeSurfaces.DATABASE],
    expectedFiles: ["src/index.js"]
  });

  const passCheck = policy.evaluateChange({ surface: ChangeSurfaces.FILES, targetFile: "src/index.js" });
  assert.equal(passCheck.decision, ScopeDecision.PASS);

  const forbiddenCheck = policy.evaluateChange({ surface: ChangeSurfaces.INFRASTRUCTURE });
  assert.equal(forbiddenCheck.decision, ScopeDecision.SCOPE_VIOLATION);

  const unapprovedSurface = policy.evaluateChange({ surface: ChangeSurfaces.UI });
  assert.equal(unapprovedSurface.decision, ScopeDecision.APPROVAL_REQUIRED);

  const unexpectedFile = policy.evaluateChange({ surface: ChangeSurfaces.FILES, targetFile: "server.js" });
  assert.equal(unexpectedFile.decision, ScopeDecision.APPROVAL_REQUIRED);
});

test("4. Policy Separation (Scope != Execution != Security != Approval)", () => {
  const scopePolicy = createScopePolicy({ allowedSurfaces: [ChangeSurfaces.FILES] });
  const execPolicy = createExecutionPolicy({ allowedCommands: ["git"], allowedWorkingDirectories: ["d:/project"] });
  const secPolicy = createSecurityPolicy({ allowSecretExposure: false, allowExternalSystemWrite: false });
  const appPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["GIT_PUSH"] });

  assert.equal(scopePolicy.type, "SCOPE_POLICY");
  assert.equal(execPolicy.type, "EXECUTION_POLICY");
  assert.equal(secPolicy.type, "SECURITY_POLICY");
  assert.equal(appPolicy.type, "APPROVAL_POLICY");

  const execCheck = execPolicy.evaluateCommand({
    executable: "rm",
    workingDirectory: "c:/windows/system32",
    isPrivileged: true
  });
  assert.equal(execCheck.allowed, false);
  assert.equal(execCheck.code, ErrorCodes.SECURITY_BLOCKED);

  const secCheck = secPolicy.evaluateAction({ actionType: "SEND_LOG", hasSecrets: true });
  assert.equal(secCheck.allowed, false);
  assert.equal(secCheck.code, ErrorCodes.SECURITY_BLOCKED);

  const appCheck = appPolicy.isApprovalRequired({ actionType: "GIT_PUSH" });
  assert.equal(appCheck.required, true);
});

test("5. AI Request vs Actual Execution Provenance Relationship", () => {
  const req = createAIRequest({
    id: "req-1",
    taskId: "t1",
    requestedCapabilities: ["coding", "tool_calling"]
  });

  const provider = createProvider({ id: "prov-openrouter", name: "OpenRouter" });
  const model = createModel({ id: "mod-claude", providerId: provider.id, name: "Claude Sonnet" });

  const audit = createAuditRecord({
    id: "aud-1",
    actor: "DeveloperAgent",
    projectId: "p1",
    action: "AI_INFERENCE",
    providerId: provider.id,
    modelId: model.id,
    result: "CODE_PRODUCED"
  });

  assert.equal(req.requestedCapabilities.includes("coding"), true);
  assert.equal(audit.actualProvider, "prov-openrouter");
  assert.equal(audit.actualModel, "mod-claude");
});

test("6. Project Brain Isolation Guarantee", () => {
  const brainA = createProjectBrain({
    projectId: "project-alpha",
    requirements: ["Req A1", "Req A2"],
    constraints: ["Node only"]
  });

  const brainB = createProjectBrain({
    projectId: "project-beta",
    requirements: ["Req B1"],
    constraints: ["Rust only"]
  });

  assert.notEqual(brainA.projectId, brainB.projectId);
  assert.deepEqual(brainA.requirements, ["Req A1", "Req A2"]);
  assert.deepEqual(brainB.requirements, ["Req B1"]);
  assert.throws(() => { brainA.requirements.push("Leaked Req"); }, TypeError);
});

test("7. Checkpoint Semantics (State Transition != Mandatory Checkpoint)", () => {
  const transition = createStateTransition({
    entityType: "TASK",
    fromState: TaskState.PENDING,
    toState: TaskState.RUNNING,
    actor: "SYSTEM",
    reason: "Task started"
  });
  assert.equal(transition.fromState, TaskState.PENDING);
  assert.equal(transition.toState, TaskState.RUNNING);

  const checkpoint = createCheckpoint({
    id: "chk-1",
    entityType: "TASK",
    entityId: "t1",
    stateSnapshotRef: "snap-104",
    reason: "CRITICAL_MILESTONE"
  });
  assert.equal(checkpoint.id, "chk-1");
  assert.equal(checkpoint.reason, "CRITICAL_MILESTONE");
});

test("8. Local Execution Boundary (System Read != System Write)", () => {
  const boundary = createExecutionBoundaryInterface({
    projectRoot: "d:/Antigravity/ONLUNET ZEKA",
    allowSystemWrite: false
  });

  assert.equal(boundary.canWriteToPath("d:/Antigravity/ONLUNET ZEKA/src/index.js"), true);
  assert.equal(boundary.canWriteToPath("c:/windows/system32/cmd.exe"), false);
});

test("9. Live AI Execution Rejection in Phase 1", async () => {
  const adapter = createProviderAdapterInterface({
    providerId: "test-prov",
    name: "Test Provider"
  });

  await assert.rejects(
    async () => await adapter.chat(),
    new RegExp(ErrorCodes.NOT_VERIFIED)
  );
});

// ==========================================
// NEW FAZ 1.1 HARDENING REMEDIATION TESTS
// ==========================================

test("10. Remediation #1: State Transition Matrix & Valid Transitions", () => {
  // Valid Project transitions
  assert.equal(validateStateTransition("PROJECT", ProjectState.DISCOVERY, ProjectState.BLUEPRINTING), true);
  assert.equal(validateStateTransition("PROJECT", ProjectState.ACTIVE, ProjectState.PAUSED), true);
  assert.equal(validateStateTransition("PROJECT", ProjectState.PAUSED, ProjectState.ACTIVE), true);

  // Valid Job transitions
  assert.equal(validateStateTransition("JOB", JobState.PENDING, JobState.READY), true);
  assert.equal(validateStateTransition("JOB", JobState.READY, JobState.RUNNING), true);
  assert.equal(validateStateTransition("JOB", JobState.RUNNING, JobState.VALIDATING), true);
  assert.equal(validateStateTransition("JOB", JobState.VALIDATING, JobState.COMPLETED), true);

  // Valid Task transitions
  assert.equal(validateStateTransition("TASK", TaskState.PENDING, TaskState.READY), true);
  assert.equal(validateStateTransition("TASK", TaskState.READY, TaskState.RUNNING), true);
  assert.equal(validateStateTransition("TASK", TaskState.RUNNING, TaskState.VALIDATING), true);
  assert.equal(validateStateTransition("TASK", TaskState.VALIDATING, TaskState.COMPLETED), true);
});

test("11. Remediation #1: Invalid State Transitions Rejection", () => {
  // Invalid transitions
  assert.throws(
    () => validateStateTransition("PROJECT", ProjectState.DISCOVERY, ProjectState.COMPLETED),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("JOB", JobState.PENDING, JobState.COMPLETED),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("TASK", TaskState.PENDING, TaskState.COMPLETED),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("PROJECT", "UNKNOWN_STATE", ProjectState.ACTIVE),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

test("12. Remediation #1: Terminal State Protection", () => {
  // Terminal Project states cannot continue
  assert.throws(
    () => validateStateTransition("PROJECT", ProjectState.COMPLETED, ProjectState.ACTIVE),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("PROJECT", ProjectState.CANCELLED, ProjectState.DISCOVERY),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  // Terminal Job states cannot continue
  assert.throws(
    () => validateStateTransition("JOB", JobState.COMPLETED, JobState.RUNNING),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("JOB", JobState.FAILED, JobState.READY),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  // Terminal Task states cannot continue
  assert.throws(
    () => validateStateTransition("TASK", TaskState.COMPLETED, TaskState.RUNNING),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
  assert.throws(
    () => validateStateTransition("TASK", TaskState.FAILED, TaskState.RUNNING),
    new RegExp(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

test("13. Remediation #2: Secure Project Path Boundary & Prefix Collision Rejection", () => {
  const projectRoot = "C:\\Projects\\App";

  // Inside project root
  assert.equal(isPathInsideDirectory("C:\\Projects\\App\\src\\index.js", projectRoot), true);
  assert.equal(isPathInsideDirectory("C:/Projects/App/src/components/button.js", projectRoot), true);
  assert.equal(isPathInsideDirectory("C:\\Projects\\App", projectRoot), true);

  // Sibling prefix collision MUST FAIL (e.g. App vs App-Evil)
  assert.equal(isPathInsideDirectory("C:\\Projects\\App-Evil\\file.js", projectRoot), false);
  assert.equal(isPathInsideDirectory("C:\\Projects\\App_evil\\exploit.exe", projectRoot), false);
  assert.equal(isPathInsideDirectory("C:\\Projects\\Application\\test.txt", projectRoot), false);
});

test("14. Remediation #2: Parent Traversal & Relative Outside Path Rejection", () => {
  const projectRoot = "C:\\Projects\\App";

  // Parent directory traversal MUST FAIL
  assert.equal(isPathInsideDirectory("C:\\Projects\\App\\..\\Secrets\\passwords.txt", projectRoot), false);
  assert.equal(isPathInsideDirectory("C:\\Projects\\App\\src\\..\\..\\Windows\\System32", projectRoot), false);

  // Relative outside path MUST FAIL
  assert.equal(isPathInsideDirectory("..\\outside.txt", projectRoot), false);
});

test("15. Remediation #3: ChangeSurfaces Exact Count & Integrity", () => {
  const surfaces = Object.values(ChangeSurfaces);
  assert.equal(surfaces.length, 12, "ChangeSurfaces must contain exactly 12 official surfaces");

  const expectedSurfaces = [
    "FILES",
    "API",
    "DATABASE",
    "DEPENDENCIES",
    "CONFIG",
    "ENVIRONMENT",
    "COMMANDS",
    "INFRASTRUCTURE",
    "UI",
    "BEHAVIOR",
    "SECURITY",
    "GENERATED_FILES"
  ];

  for (const expected of expectedSurfaces) {
    assert.equal(surfaces.includes(expected), true, `Missing official surface: ${expected}`);
  }
});

test("16. Remediation #4: Explicit AI Provenance (Requested vs Actual vs Fallback)", () => {
  const req = createAIRequest({
    id: "req-101",
    taskId: "t-42",
    requestedCapabilities: ["reasoning", "coding"],
    requestedProvider: "OpenAI",
    requestedModel: "gpt-4o"
  });

  assert.equal(req.requestedProvider, "OpenAI");
  assert.equal(req.requestedModel, "gpt-4o");

  // Fallback audit representation
  const audit = createAuditRecord({
    id: "aud-fallback-1",
    actor: "Router",
    projectId: "p-1",
    action: "AI_ROUTED_INFERENCE",
    requestedProvider: req.requestedProvider,
    requestedModel: req.requestedModel,
    actualProvider: "Anthropic",
    actualModel: "claude-3-5-sonnet",
    fallbackUsed: true,
    fallbackProvider: "Anthropic",
    fallbackModel: "claude-3-5-sonnet",
    latencyMs: 1420,
    cost: 0.012,
    tokenUsage: { inputTokens: 500, outputTokens: 250 },
    result: "SUCCESS"
  });

  assert.equal(audit.requestedProvider, "OpenAI");
  assert.equal(audit.requestedModel, "gpt-4o");
  assert.equal(audit.actualProvider, "Anthropic");
  assert.equal(audit.actualModel, "claude-3-5-sonnet");
  assert.equal(audit.fallbackUsed, true);
  assert.equal(audit.fallbackProvider, "Anthropic");
  assert.equal(audit.latencyMs, 1420);
  assert.equal(audit.tokenUsage.inputTokens, 500);
});

test("17. Remediation #5: AuditRecord Strictly Forbids Raw AI Content", () => {
  // Rejection of rawPrompt
  assert.throws(
    () => createAuditRecord({
      id: "aud-err-1",
      actor: "Dev",
      projectId: "p1",
      action: "AI",
      result: "OK",
      rawPrompt: "Secret user data"
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  // Rejection of rawResponse
  assert.throws(
    () => createAuditRecord({
      id: "aud-err-2",
      actor: "Dev",
      projectId: "p1",
      action: "AI",
      result: "OK",
      rawResponse: "API KEY = 12345"
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  // Rejection of fullPrompt / fullResponse
  assert.throws(
    () => createAuditRecord({
      id: "aud-err-3",
      actor: "Dev",
      projectId: "p1",
      action: "AI",
      result: "OK",
      fullPrompt: "All system prompts"
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

test("18. Remediation #6: Audit Ledger Status Clarification", () => {
  const ledger = createAuditLedgerInterface();
  assert.equal(ledger.implementationStatus, "IN_MEMORY_HARNESS");
  assert.equal(ledger.architectureSpecification, "TAMPER_EVIDENT_APPEND_ORIENTED");
  assert.equal(typeof ledger.appendRecord, "function");
  assert.equal(typeof ledger.getRecords, "function");
});
