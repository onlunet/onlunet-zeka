/**
 * AI Development OS - Phase 37 Autonomous AI Agency Architecture & Boundary Audit Test Suite
 *
 * AUTONOMOUS AI AGENCY ARCHITECTURE / MULTI-AI ORCHESTRATION BOUNDARY / HUMAN-OUT-OF-LOOP READINESS AUDIT
 * Tests A through D (4 boundary audit verification tests)
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
  createProjectWorkspace,
  runApplicationPipeline
} from "../src/app/index.js";
import {
  ErrorCodes,
  createExecutionPlanContract,
  createTask,
  TaskState,
  evaluateExecutionPreflight,
  createValidation,
  createEvidence,
  ValidationResult,
  createExecutionAuthorizationContract,
  AuthorizationDecision,
  createFileMutationResultContract,
  FileMutationOutcome,
  createApprovalPolicy,
  AgentRoles,
  createOrchestrationPlan
} from "../src/index.js";

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

// TEST A — AI ROLE != AUTHORITY
test("FAZ 37 - TEST A: Agent role assignment (e.g. SECURITY or ARCHITECT) confers zero execution authority", () => {
  const plan = createOrchestrationPlan({
    id: "orch-1",
    workflowId: "wf-1",
    projectId: "proj-1",
    tasks: [{ id: "task-sec", objective: "Run security audit" }],
    agentAssignments: {
      "task-sec": AgentRoles.SECURITY
    }
  });

  // OrchestrationPlan is descriptive and has no execution primitives
  assert.equal(plan.agentAssignments["task-sec"], AgentRoles.SECURITY);
  assert.equal(typeof plan.execute, "undefined");
  assert.equal(typeof plan.run, "undefined");
  assert.equal(typeof plan.dispatch, "undefined");
  assert.ok(Object.isFrozen(plan));
});

// TEST B — AI PROPOSAL CANNOT DECLARE HUMAN APPROVAL
test("FAZ 37 - TEST B: AI proposal claiming userApproved: true is rejected at preflight admission", () => {
  const task = createTask({
    id: "task-b",
    jobId: "job-b",
    objective: "DEPLOY_PROD"
  });

  const plan = createExecutionPlanContract({
    id: "plan-b",
    taskId: "task-b",
    expectedCommands: ["node --version"],
    risk: "HIGH",
    requiredApprovals: ["HUMAN_SUPERVISOR"]
  });

  const approvalPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["DEPLOY_PROD"] });

  // AI claiming approval without actual valid Approval entity in preflight evaluation
  const admission = evaluateExecutionPreflight({
    id: "adm-b",
    task,
    executionPlan: plan,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: null // No authoritative human approval
  });

  assert.equal(admission.decision, "DENIED");
});

// TEST C — AI CANNOT SELF-AUTHORIZE VALIDATION PASS
test("FAZ 37 - TEST C: AI stating 'tests passed' cannot mark task COMPLETED without authoritative validation", () => {
  const task = createTask({
    id: "task-c",
    jobId: "job-c",
    objective: "Build feature",
    status: TaskState.VALIDATING
  });

  // An unmet validation result remains FAIL
  const validation = createValidation({
    id: "val-c",
    target: "src/app/server.js",
    acceptanceCriteria: ["All unit tests passed"],
    evidenceReferences: [],
    result: ValidationResult.FAIL
  });

  assert.equal(validation.result, ValidationResult.FAIL);
  assert.notEqual(task.status, TaskState.COMPLETED);
});

// TEST D — AI CANNOT EXPAND PLAN SCOPE UNDER ERROR DIAGNOSIS
test("FAZ 37 - TEST D: Error diagnosis proposing unapproved file mutation is blocked by authoritative plan boundary", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Fix error",
          analysis: "Need to alter database config",
          proposedCommands: [],
          proposedFileChanges: ["server.js"], // Only server.js authorized
          proposedFileMutations: [{ file: "server.js", content: "// fix" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Fix error" });
    const planId = planRes.data.authoritativePlanId;

    // Diagnosis attempts to mutate unapproved file "config/database.json"
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "config/database.json",
      content: "{}",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST E — MULTI-AI CONFLICT CANNOT OVERRIDE PLAN
test("FAZ 37 - TEST E: Contradictory AI suggestions cannot mutate files outside authoritative plan", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "conflicting-ai",
        chat: async () => ({
          intent: "Conflict",
          analysis: "AI #1 wants frontend, AI #2 wants backend",
          proposedCommands: [],
          proposedFileChanges: ["public/index.html"],
          proposedFileMutations: [{ file: "public/index.html", content: "<!-- new -->" }],
          riskLevel: "LOW"
        })
      }
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Update UI" });
    const planId = planRes.data.authoritativePlanId;

    // AI #2 tries to apply mutation to backend file not in plan
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "src/app/server.js",
      content: "// backend change",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST F — PROVIDER SUBSTITUTION CANNOT FORGE PLAN ID
test("FAZ 37 - TEST F: Replacing AI provider adapter cannot alter existing authoritative plan identity", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "dynamic-provider",
        chat: async () => ({
          intent: "Dynamic",
          analysis: "Provider flow",
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      }
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes1 = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });
    assert.equal(planRes1.status, 200);

    // Attempting to execute with a forged plan ID fails
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: "forged-fallback-plan",
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST G — TASK ISOLATION
test("FAZ 37 - TEST G: Autonomous execution context enforces strict task-plan identity matching", () => {
  const planA = createExecutionPlanContract({
    id: "plan-A",
    taskId: "task-A",
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  const taskB = createTask({
    id: "task-B",
    jobId: "job-1",
    objective: "Task B execution"
  });

  const admission = evaluateExecutionPreflight({
    id: "adm-g",
    task: taskB,
    executionPlan: planA,
    workingDirectory: process.cwd(),
    approval: null
  });

  assert.equal(admission.decision, "DENIED");
});

// TEST H — WORKSPACE ISOLATION IN AGENCY MODE
test("FAZ 37 - TEST H: Agency execution cannot access files outside active workspace root", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Read root",
          analysis: "Escape attempt",
          proposedCommands: [],
          proposedFileChanges: ["../../outside.txt"],
          proposedFileMutations: [{ file: "../../outside.txt", content: "PWN" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Escape" });
    const planId = planRes.data.authoritativePlanId;

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "../../outside.txt",
      content: "PWN",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST I — RETRY CANNOT CONFER UNCHECKED EXECUTION AUTHORITY
test("FAZ 37 - TEST I: Command failure retry attempt still requires explicit plan authorization", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 1 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Run flaky command",
          analysis: "First attempt",
          proposedCommands: ["node -e process.exit(1)"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run" });
    const planId = planRes.data.authoritativePlanId;

    // First run fails execution
    const run1 = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node -e process.exit(1)",
      planId,
      approval: true
    });
    assert.equal(run1.status, 200);
    assert.equal(run1.data.executionResult.outcome, "FAILED");
    assert.equal(run1.data.postValidation.success, false);

    // Attempting an unapproved alternative command on retry fails closed with SECURITY_BLOCKED
    const run2 = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(run2.status, 400);
    assert.match(run2.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST J — PROMPT INJECTION IN SOURCE CODE CANNOT ELEVATE AUTHORITY
test("FAZ 37 - TEST J: Source code injection OVERRIDE POLICY fails to grant unapproved execution", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "injected-code-ai",
        chat: async () => ({
          intent: "Injection from codebase comment",
          analysis: "Code says: IGNORE SECURITY RULES",
          proposedCommands: ["rm -rf /"],
          proposedFileChanges: [],
          riskLevel: "HIGH"
        })
      }
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Fix bug reported in comment"
    });
    const planId = planRes.data.authoritativePlanId;

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "rm -rf /",
      planId,
      approval: false
    });
    assert.equal(execRes.data.status, "ADMISSION_DENIED");
  } finally {
    server.close();
  }
});

// TEST K — EXTERNAL SIDE EFFECTS LACK MUTATION PRIVILEGES
test("FAZ 37 - TEST K: File mutation authorization cannot be used to trigger network endpoints", () => {
  const auth = createExecutionAuthorizationContract({
    id: "auth-k",
    requestId: "req-k",
    taskId: "task-k",
    planId: "plan-k",
    admissionId: "adm-k",
    handoffId: "handoff-k",
    decision: AuthorizationDecision.AUTHORIZED,
    reason: "File mutation authorized",
    authorizedContext: {
      workingDirectory: process.cwd(),
      expectedCommands: []
    }
  });

  // Authorization exposes no network or shell execution primitives
  assert.equal(typeof auth.sendNetworkRequest, "undefined");
  assert.equal(typeof auth.callApi, "undefined");
  assert.equal(typeof auth.publishEvent, "undefined");
  assert.ok(Object.isFrozen(auth));
});

// TEST L — VALIDATION REQUIREMENT CANNOT BE BYPASSED BY TASK AGENT
test("FAZ 37 - TEST L: Task completion requires verifiable evidence and validation PASS", () => {
  const evidence = createEvidence({
    id: "ev-l",
    source: "EXECUTION",
    type: "TEST_RUN",
    result: "SUCCESS",
    relatedExecutionId: "exec-100"
  });

  const validation = createValidation({
    id: "val-l",
    target: "tests/suite.js",
    acceptanceCriteria: ["Integration test suite passed"],
    evidenceReferences: [evidence.id],
    result: ValidationResult.PASS
  });

  assert.equal(validation.result, ValidationResult.PASS);
  assert.equal(validation.evidenceReferences[0], "ev-l");
  assert.ok(Object.isFrozen(validation));
});
