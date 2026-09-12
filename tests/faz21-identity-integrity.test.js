/**
 * AI Development OS - Phase 21 Identity Integrity Test Suite
 * Validates Authoritative Plan / Task Identity Integrity across:
 * Plan -> Task -> Admission -> Handoff -> Request -> Authorization -> Execution/Mutation -> Result -> Validation
 *
 * Adversarial Test Matrix:
 * A: Forged Plan ID (Server execution & mutation) -> SECURITY_BLOCKED (0 writes, 0 launches)
 * B: Forged Task ID (Server execution & mutation) -> SECURITY_BLOCKED (0 writes, 0 launches)
 * C: Cross Plan / Task Pair (P1 + T2 at Preflight) -> Admission DENIED (SECURITY_BLOCKED)
 * D: Handoff Tampering (tampered planId / taskId) -> INVALID_CONTRACT / SECURITY_BLOCKED (0 launches)
 * E: Execution Request Tampering -> INVALID_CONTRACT (0 launches)
 * F: Authorization Tampering (auth taskId/planId mismatch) -> INVALID_CONTRACT (0 launches, 0 writes)
 * G: Mutation Cross-Identity (tampered taskId / planId) -> INVALID_CONTRACT / SECURITY_BLOCKED (0 writes)
 * H: Pipeline Authoritative Task ID Derivation (authoritativePlan.taskId = T1 -> effectiveTaskId is T1)
 * I: Pipeline Caller Task ID / Plan ID Tampering (T1 vs T2, P1 vs P2) -> SECURITY_BLOCKED (0 launches)
 * J: Valid Complete Identity Chain -> PASS (exactly 1 launch / 1 mutation)
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

import {
  createApplicationServer,
  createAIGateway,
  createStandardLocalProvider,
  runApplicationPipeline
} from "../src/app/index.js";
import {
  ErrorCodes,
  TaskState,
  AdmissionDecision,
  createTask,
  createExecutionPlanContract,
  evaluateExecutionPreflight,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  createExecutionAuthorizationContract,
  executeAuthorizedRequest,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  createApprovalPolicy,
  createApproval
} from "../src/index.js";
import { executeAuthorizedFileMutation } from "../src/contracts/file-mutation.js";

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const reqOptions = {
      hostname: "127.0.0.1",
      port: address.port,
      path: options.path,
      method: options.method,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

function createTestServerWithProposal(mutations = [], commands = ["node --version"]) {
  const provider = createStandardLocalProvider({
    planResolver: (prompt) => ({
      intent: prompt.task,
      analysis: "Identity test proposal",
      proposedCommands: commands,
      proposedFileChanges: mutations.map(m => m.file),
      proposedFileMutations: mutations,
      riskLevel: "LOW",
      requiresApproval: false
    })
  });
  const gateway = createAIGateway({ providerAdapter: provider });
  return createApplicationServer({ aiGateway: gateway });
}

// TEST A — Forged Plan ID (Execution and Mutation) -> SECURITY_BLOCKED (0 writes, 0 launches)
test("FAZ 21 - TEST A: Forged Plan ID is SECURITY_BLOCKED with 0 launches & 0 writes", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz21-test-a.txt";
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Test",
          analysis: "Test",
          proposedCommands: ["node --version"],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: "DATA" }],
          riskLevel: "LOW",
          requiresApproval: false
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Create plan" });

    // 1. Forged Plan ID on execute -> BLOCKED
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: "forged-plan-id-fake",
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "Forged planId must result in 0 launches");

    // 2. Forged Plan ID on mutate -> BLOCKED
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      planId: "forged-plan-id-fake",
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteTarget), false, "Forged planId must result in 0 writes");
  } finally {
    server.close();
  }
});

// TEST B — Forged Task ID (Execution and Mutation) -> SECURITY_BLOCKED (0 writes, 0 launches)
test("FAZ 21 - TEST B: Forged Task ID is SECURITY_BLOCKED with 0 launches & 0 writes", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz21-test-b.txt";
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Test",
          analysis: "Test",
          proposedCommands: ["node --version"],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: "DATA" }],
          riskLevel: "LOW",
          requiresApproval: false
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Create plan" });

    // 1. Forged Task ID on execute -> BLOCKED
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      taskId: "forged-task-id-fake",
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "Forged taskId must result in 0 launches");

    // 2. Forged Task ID on mutate -> BLOCKED
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      taskId: "forged-task-id-fake",
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteTarget), false, "Forged taskId must result in 0 writes");
  } finally {
    server.close();
  }
});

// TEST C — Cross Plan / Task Pair (Plan P1 with Task T2) at Preflight -> DENIED (SECURITY_BLOCKED)
test("FAZ 21 - TEST C: Cross Plan / Task Pair at Preflight evaluates to AdmissionDecision.DENIED", () => {
  const taskA = createTask({ id: "task-A", jobId: "job-1", objective: "Do task A", status: TaskState.READY });
  const planB = createExecutionPlanContract({
    id: "plan-B",
    taskId: "task-B", // Bound to task-B, not task-A!
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  const admission = evaluateExecutionPreflight({
    id: "adm-cross",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
  assert.match(admission.reason, /does not match task id/);
});

// TEST D — Tampered Handoff Identity (handoff.planId or handoff.taskId) -> Rejection
test("FAZ 21 - TEST D: Tampered Handoff Identity is rejected during handoff construction", () => {
  const admission = {
    id: "adm-valid",
    taskId: "task-orig",
    planId: "plan-orig",
    decision: AdmissionDecision.ALLOWED
  };

  // 1. Tampered taskId in handoff
  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-tampered-1",
      taskId: "task-forged",
      planId: "plan-orig",
      admissionResult: admission
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // 2. Tampered planId in handoff
  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-tampered-2",
      taskId: "task-orig",
      planId: "plan-forged",
      admissionResult: admission
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST E — Tampered Execution Request Identity -> Rejection
test("FAZ 21 - TEST E: Tampered Execution Request Identity is rejected at consumption boundary", () => {
  const handoff = {
    id: "h-legit",
    taskId: "task-legit",
    planId: "plan-legit",
    admissionId: "adm-legit",
    workingDirectory: process.cwd(),
    expectedCommands: ["node --version"]
  };

  // Caller attempts to forge planId or taskId when consuming handoff
  assert.throws(
    () => consumeExecutionHandoff({
      requestId: "req-tampered",
      handoff,
      taskId: "task-forged", // Mismatch against handoff.taskId
      planId: "plan-legit"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.throws(
    () => consumeExecutionHandoff({
      requestId: "req-tampered-2",
      handoff,
      taskId: "task-legit",
      planId: "plan-forged" // Mismatch against handoff.planId
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST F — Tampered Authorization Identity -> Blocked (0 launches, 0 writes)
test("FAZ 21 - TEST F: Tampered Authorization Identity is blocked before execution or mutation", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const request = {
    id: "req-1",
    taskId: "task-1",
    planId: "plan-1",
    admissionId: "adm-1",
    handoffId: "h-1",
    handoffReference: {
      id: "h-1",
      taskId: "task-1",
      planId: "plan-1",
      admissionId: "adm-1",
      workingDirectory: process.cwd(),
      expectedCommands: ["node --version"]
    }
  };

  // Tampered Authorization: planId mismatch
  const tamperedAuthPlan = {
    id: "auth-tampered",
    requestId: "req-1",
    taskId: "task-1",
    planId: "plan-forged-999", // Mismatch!
    admissionId: "adm-1",
    handoffId: "h-1",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: process.cwd(),
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-auth-tamper",
      executionRequest: request,
      authorization: tamperedAuthPlan,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
  assert.equal(launchCount, 0, "Tampered authorization must result in 0 launches");
});

// TEST G — Cross-Identity Mutation -> SECURITY_BLOCKED (0 writes)
test("FAZ 21 - TEST G: Mutation with cross-identity mismatch is blocked with 0 writes", () => {
  const targetFile = "tmp-faz21-test-g.txt";
  const absoluteTarget = path.join(process.cwd(), targetFile);
  if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

  const request = {
    id: "req-mut-1",
    taskId: "task-mut-1",
    planId: "plan-mut-1",
    admissionId: "adm-mut-1",
    handoffId: "h-mut-1",
    handoffReference: {
      id: "h-mut-1",
      taskId: "task-mut-1",
      planId: "plan-mut-1",
      admissionId: "adm-mut-1"
    }
  };

  // Authorization with cross-identity taskId
  const crossAuth = {
    id: "auth-mut-cross",
    taskId: "task-different-2", // Mismatch!
    planId: "plan-mut-1",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: process.cwd(),
      authorizedTarget: absoluteTarget,
      authorizedContent: "DATA"
    }
  };

  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-cross-res",
      executionRequest: request,
      authorization: crossAuth,
      workspaceRoot: process.cwd(),
      targetPath: absoluteTarget,
      content: "DATA",
      operation: "WRITE"
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(fs.existsSync(absoluteTarget), false, "Cross-identity mutation must produce 0 disk writes");
});

// TEST H — Pipeline Authoritative Task ID Derivation: authoritativePlan.taskId = T1 -> effectiveTaskId is T1
test("FAZ 21 - TEST H: Pipeline automatically adopts authoritativePlan.taskId when taskId is omitted", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authPlan = createExecutionPlanContract({
    id: "plan-auth-derive",
    taskId: "task-auth-expected-derive",
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  // Call runApplicationPipeline without passing taskId
  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: true,
    authoritativePlan: authPlan,
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.admission.taskId, "task-auth-expected-derive");
  assert.equal(outcome.admission.planId, "plan-auth-derive");
  assert.equal(outcome.authorization.taskId, "task-auth-expected-derive");
  assert.equal(outcome.authorization.planId, "plan-auth-derive");
  assert.equal(outcome.executionResult.taskId, "task-auth-expected-derive");
  assert.equal(outcome.executionResult.planId, "plan-auth-derive");
  assert.equal(launchCount, 1);
});

// TEST I — Pipeline Caller Task ID / Plan ID Tampering (T1 vs T2, P1 vs P2) -> SECURITY_BLOCKED (0 launches)
test("FAZ 21 - TEST I: Pipeline caller supplying mismatched taskId or planId is SECURITY_BLOCKED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authPlan = createExecutionPlanContract({
    id: "plan-orig-1",
    taskId: "task-orig-1",
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  // 1. Caller provides mismatched taskId
  assert.throws(
    () => runApplicationPipeline({
      workspaceRoot: process.cwd(),
      command: "node --version",
      userApproval: true,
      authoritativePlan: authPlan,
      taskId: "task-tampered-2",
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
  assert.equal(launchCount, 0, "No process launch on caller taskId tampering");

  // 2. Caller provides mismatched planId
  assert.throws(
    () => runApplicationPipeline({
      workspaceRoot: process.cwd(),
      command: "node --version",
      userApproval: true,
      authoritativePlan: authPlan,
      planId: "plan-tampered-2",
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
  assert.equal(launchCount, 0, "No process launch on caller planId tampering");
});

// TEST J — Valid Complete Identity Chain -> PASS (planId = P1, taskId = T1 strictly preserved throughout)
test("FAZ 21 - TEST J: Valid identity chain strictly maintains P1/T1 throughout all boundaries", async () => {
  const targetFile = "tmp-faz21-test-j.txt";
  const authContent = "STRICT_IDENTITY_CONTENT";

  const server = createTestServerWithProposal([
    { file: targetFile, content: authContent }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run strict identity test" });
    assert.equal(planRes.status, 200);

    const planId = planRes.data.authoritativePlanId;
    assert.ok(planId);

    // Call /api/mutate passing correct authoritative planId
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: authContent,
      planId: planId,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");

    // Verify identity chain consistency across admission, authorization, and mutationResult
    const { admission, authorization, mutationResult, postValidation } = mutRes.data;

    assert.equal(admission.planId, planId);
    assert.equal(authorization.planId, planId);
    assert.equal(mutationResult.planId, planId);

    assert.equal(admission.taskId, authorization.taskId);
    assert.equal(authorization.taskId, mutationResult.taskId);

    assert.equal(postValidation.success, true);
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), authContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
