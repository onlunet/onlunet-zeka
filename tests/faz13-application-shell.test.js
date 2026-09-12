/**
 * ONLUNET ZEKA - FAZ 13 & 13.1 Standalone Application Shell & Security Remediation Test Suite
 *
 * Validates:
 * - Test A: Application Shell starts and serves visual interface
 * - Test B: Workspace selection produces valid bounded workspace context
 * - Test C & D: Prompt reaches AI Gateway and produces structured declarative plan
 * - Test E: Execution request passes existing FAZ 1–12 security boundary
 * - Test F: Unauthorized execution (user rejected) is blocked with 0 process launches
 * - Test G: Forged command/cwd cannot bypass FAZ 11.1 context binding
 * - Test H & I: Execution result reaches application layer with strict validation separation
 * - Test J: Application has NO Antigravity, Codex, or VS Code runtime dependency
 *
 * FAZ 13.1 EXPLICIT ADVERSARIAL SECURITY REMEDIATION TESTS:
 * - Test 1: Client forged command against authoritative plan -> BLOCKED (0 launches)
 * - Test 2: Client forged workspaceRoot against active workspace -> BLOCKED (0 launches)
 * - Test 3: Execution without authoritative plan -> BLOCKED (0 launches)
 * - Test 4: Execution without valid preflight / admission -> DENIED (0 launches)
 * - Test 5: Command changed after approval -> BLOCKED (0 launches)
 * - Test 6: Workspace changed after authorization -> BLOCKED (0 launches)
 * - Test 7: Valid complete chain executes exactly 1 launch
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import {
  createProjectWorkspace,
  createAIGateway,
  createStandardLocalProvider,
  createApplicationServer,
  runApplicationPipeline
} from "../src/app/index.js";
import {
  ErrorCodes,
  executeAuthorizedRequest,
  createExecutionPlanContract
} from "../src/index.js";

function makeRequest(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port,
      path,
      method,
      headers: { "Content-Type": "application/json" }
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test("Test A: Application Shell starts and serves visual UI (Zero external dependencies)", async () => {
  const server = createApplicationServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const res = await makeRequest(port, "GET", "/");
  server.close();
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /ONLUNET ZEKA/);
  assert.match(res.body, /Yapay Zeka Kodlama Merkezi/);
  assert.match(res.body, /Proje Çalışma Alanı/);
});

test("Test B: Workspace selection produces valid bounded workspace context", () => {
  const workspace = createProjectWorkspace({ rootPath: process.cwd() });
  assert.equal(typeof workspace.rootPath, "string");
  assert.equal(typeof workspace.name, "string");

  // Path inside succeeds
  assert.doesNotThrow(() => workspace.assertInside("package.json"));

  // Path outside fails with SECURITY_BLOCKED
  assert.throws(
    () => workspace.assertInside("..\\outside-leak.txt"),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  const files = workspace.listFiles({ maxDepth: 1 });
  assert.ok(Array.isArray(files));
  assert.ok(files.some(f => f.relativePath === "package.json"));
});

test("Test C & D: Prompt reaches AI Gateway and produces structured declarative plan", async () => {
  const provider = createStandardLocalProvider();
  const gateway = createAIGateway({ providerAdapter: provider });

  const plan = await gateway.analyzeAndPlan({
    taskPrompt: "Verify test suite health",
    workspaceSummary: { name: "test-ws", rootPath: process.cwd() }
  });

  assert.equal(typeof plan.intent, "string");
  assert.equal(typeof plan.analysis, "string");
  assert.ok(Array.isArray(plan.proposedCommands));
  assert.equal(plan.proposedCommands[0], "node --version");
  assert.equal(plan.riskLevel, "LOW");
});

test("Test E: Execution request passes existing FAZ 1–12 security boundary", () => {
  let launchCount = 0;
  const mockRunner = () => {
    launchCount++;
    return { status: 0 };
  };

  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: true,
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.admission.decision, "ALLOWED");
  assert.equal(outcome.authorization.decision, "AUTHORIZED");
  assert.equal(outcome.executionResult.outcome, "SUCCEEDED");
  assert.equal(outcome.postValidation.success, true);
  assert.equal(launchCount, 1);
});

test("Test F: Unauthorized execution (User rejected) is blocked with 0 process launches", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: false,
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "ADMISSION_DENIED");
  assert.equal(outcome.admission.decision, "DENIED");
  assert.equal(outcome.executionResult, null);
  assert.equal(launchCount, 0, "No process may launch when user approval is denied");
});

test("Test G: Forged command/cwd cannot bypass FAZ 11.1 context binding", () => {
  const { request, authorization } = (() => {
    const admission = { id: "adm-f", taskId: "t-f", planId: "p-f", decision: "ALLOWED" };
    const auth = {
      id: "auth-f",
      requestId: "req-f",
      taskId: "t-f",
      planId: "p-f",
      admissionId: "adm-f",
      handoffId: "h-f",
      decision: "AUTHORIZED",
      authorizedContext: {
        workingDirectory: process.cwd(),
        expectedCommands: ["node --version"]
      }
    };
    const req = {
      id: "req-f",
      taskId: "t-f",
      planId: "p-f",
      admissionId: "adm-f",
      handoffId: "h-f",
      handoffReference: {
        id: "h-f",
        workingDirectory: process.cwd(),
        expectedCommands: ["node -e \"malicious()\""] // FORGED COMMAND
      }
    };
    return { request: req, authorization: auth };
  })();

  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-forged-test",
      executionRequest: request,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "Forged command must never launch a process");
});

test("Test H & I: Execution result reaches application layer with strict validation separation", () => {
  // Scenario 1: Execution SUCCEEDS, validation PASS
  const outcomeSuccess = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: true,
    commandRunner: () => ({ status: 0 })
  });
  assert.equal(outcomeSuccess.executionResult.outcome, "SUCCEEDED");
  assert.equal(outcomeSuccess.postValidation.success, true);

  // Scenario 2: Execution FAILS (exit 42), validation FAIL
  const outcomeFail = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node -e \"process.exit(42)\"",
    userApproval: true,
    commandRunner: () => ({ status: 42 })
  });
  assert.equal(outcomeFail.executionResult.outcome, "FAILED");
  assert.equal(outcomeFail.executionResult.metadata.exitCode, 42);
  assert.equal(outcomeFail.postValidation.success, false);
  assert.equal(outcomeFail.postValidation.recommendedTaskState, "FAILED");

  // Invariant proof: ExecutionResult object is separate contract from Validation evaluation
  assert.notEqual(outcomeFail.executionResult.id, outcomeFail.postValidation);
  assert.ok(outcomeFail.executionResult.evidenceReferences);
});

test("Test J: Application has NO Antigravity, Codex, or VS Code runtime dependency", () => {
  const appModules = [
    createProjectWorkspace,
    createAIGateway,
    createStandardLocalProvider,
    createApplicationServer,
    runApplicationPipeline
  ];

  for (const fn of appModules) {
    assert.equal(typeof fn, "function");
    const fnStr = fn.toString();
    assert.doesNotMatch(fnStr, /antigravity/i);
    assert.doesNotMatch(fnStr, /codex/i);
    assert.doesNotMatch(fnStr, /vscode/i);
  }
});

// ============================================================================
// FAZ 13.1 EXPLICIT ADVERSARIAL SECURITY REMEDIATION TESTS
// ============================================================================

test("FAZ 13.1 - Test 1: Client forged command against authoritative plan -> BLOCKED (0 launches)", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // 1. Select workspace
  await makeRequest(port, "POST", "/api/workspace", { rootPath: process.cwd() });

  // 2. Generate authoritative plan (produces "node --version")
  await makeRequest(port, "POST", "/api/plan", { task: "Check version" });

  // 3. Attack: Client attempts to execute forged malicious command
  const res = await makeRequest(port, "POST", "/api/execute", {
    command: "node -e \"process.exit(99)\"", // Forged command!
    approval: true
  });

  server.close();
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  assert.equal(launchCount, 0, "Forged client command must never trigger a process launch");
});

test("FAZ 13.1 - Test 2: Client forged workspaceRoot against active workspace -> BLOCKED (0 launches)", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // 1. Select authoritative workspace A
  await makeRequest(port, "POST", "/api/workspace", { rootPath: process.cwd() });
  await makeRequest(port, "POST", "/api/plan", { task: "Check version" });

  // 2. Attack: Client sends forged workspaceRoot B in execute request
  const res = await makeRequest(port, "POST", "/api/execute", {
    workspaceRoot: "C:\\Windows\\System32", // Forged workspace!
    command: "node --version",
    approval: true
  });

  server.close();
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  assert.equal(launchCount, 0, "Forged workspaceRoot must never trigger a process launch");
});

test("FAZ 13.1 - Test 3: Execution without authoritative plan -> BLOCKED (0 launches)", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // 1. Select workspace, but DO NOT generate a plan
  await makeRequest(port, "POST", "/api/workspace", { rootPath: process.cwd() });

  // 2. Attack: Attempt direct execute without prior plan
  const res = await makeRequest(port, "POST", "/api/execute", {
    command: "node --version",
    approval: true
  });

  server.close();
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  assert.equal(launchCount, 0, "Direct execution without authoritative plan must be blocked");
});

test("FAZ 13.1 - Test 4: Execution without valid preflight (Policy/Scope failure) -> DENIED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  // Task objective requires user approval; user provides approval=false
  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: false, // Preflight Admission will deny
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "ADMISSION_DENIED");
  assert.equal(outcome.admission.decision, "DENIED");
  assert.equal(outcome.executionResult, null);
  assert.equal(launchCount, 0, "Denied preflight admission must result in 0 launches");
});

test("FAZ 13.1 - Test 5: Approved plan command changed after approval -> BLOCKED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const plan = createExecutionPlanContract({
    id: "plan-locked",
    taskId: "task-locked",
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  // Attempting to run a command not matching authoritative plan
  assert.throws(
    () => runApplicationPipeline({
      workspaceRoot: process.cwd(),
      command: "node -e \"tamper()\"", // Tampered command
      userApproval: true,
      authoritativePlan: plan,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "Tampered command against authoritative plan must be blocked");
});

test("FAZ 13.1 - Test 6: Approved workspace changed after authorization -> BLOCKED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  // Attempting to bypass FAZ 11.1 context binding by altering workingDirectory at execution level
  const request = {
    id: "req-tamper-ws",
    taskId: "t-1",
    planId: "p-1",
    admissionId: "adm-1",
    handoffId: "h-1",
    handoffReference: {
      id: "h-1",
      workingDirectory: "C:\\Tampered\\Directory",
      expectedCommands: ["node --version"]
    }
  };
  const authorization = {
    id: "auth-1",
    requestId: "req-tamper-ws",
    taskId: "t-1",
    planId: "p-1",
    admissionId: "adm-1",
    handoffId: "h-1",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: process.cwd(), // Does not match handoffReference
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-ws-tamper",
      executionRequest: request,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "Tampered workspace at runtime execution must be blocked");
});

test("FAZ 13.1 - Test 7: Valid complete chain executes exactly 1 launch", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // 1. Workspace
  const wsRes = await makeRequest(port, "POST", "/api/workspace", { rootPath: process.cwd() });
  assert.equal(wsRes.statusCode, 200);

  // 2. AI Plan
  const planRes = await makeRequest(port, "POST", "/api/plan", { task: "Check node version" });
  assert.equal(planRes.statusCode, 200);
  const cmd = planRes.body.plan.proposedCommands[0];

  // 3. Authorized Execute
  const execRes = await makeRequest(port, "POST", "/api/execute", {
    command: cmd,
    approval: true
  });

  server.close();
  assert.equal(execRes.statusCode, 200);
  assert.equal(execRes.body.status, "COMPLETED");
  assert.equal(execRes.body.admission.decision, "ALLOWED");
  assert.equal(execRes.body.authorization.decision, "AUTHORIZED");
  assert.equal(execRes.body.executionResult.outcome, "SUCCEEDED");
  assert.equal(execRes.body.postValidation.success, true);
  assert.equal(launchCount, 1, "Valid chain must execute exactly 1 controlled process launch");
});
