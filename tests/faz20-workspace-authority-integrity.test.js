/**
 * AI Development OS - Phase 20 Workspace Authority & Execution Context Integrity Test Suite
 *
 * Enforces:
 * - INVARIANT A: Missing/Empty/Whitespace rootPath on /api/workspace is REJECTED (no implicit process.cwd fallback)
 * - INVARIANT B: Workspace change invalidates plan (authoritativeActivePlan = null)
 * - INVARIANT C: Client workspace tampering blocked with 0 writes & 0 launches
 * - INVARIANT D: Authoritative plan workspace mismatch is SECURITY_BLOCKED
 * - INVARIANT E: Handoff workspace tampering is BLOCKED
 * - INVARIANT F: Authorization workspace tampering is BLOCKED
 * - INVARIANT G: Path traversal outside workspace is SECURITY_BLOCKED (0 writes)
 * - INVARIANT H: Valid explicit workspace correctly executes end-to-end authorized mutation
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
  executeAuthorizedRequest,
  createExecutionPlanContract
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

function createTestServerWithFileProposal(mutations = []) {
  const provider = createStandardLocalProvider({
    planResolver: (prompt) => ({
      intent: prompt.task,
      analysis: "Workspace authority test proposal",
      proposedCommands: ["node --version"],
      proposedFileChanges: mutations.map(m => m.file),
      proposedFileMutations: mutations,
      riskLevel: "LOW",
      requiresApproval: false
    })
  });
  const gateway = createAIGateway({ providerAdapter: provider });
  return createApplicationServer({ aiGateway: gateway });
}

// TEST 1 — Missing workspaceRoot: Request {} to /api/workspace -> REJECTED, no activeWorkspace
test("FAZ 20 - TEST 1: Missing workspaceRoot is REJECTED without implicit process.cwd fallback", async () => {
  const server = createApplicationServer();
  await new Promise(r => server.listen(0, r));

  try {
    const res = await makeRequest(server, { method: "POST", path: "/api/workspace" }, {});
    assert.equal(res.status, 400);
    assert.match(res.data.error, new RegExp(ErrorCodes.INVALID_CONTRACT));

    // Must NOT permit plan without activeWorkspace
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Verify no workspace" });
    assert.equal(planRes.status, 400);
    assert.match(planRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.match(planRes.data.error, /No active workspace selected/);

    // Must NOT permit mutation without activeWorkspace
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, { targetPath: "test.txt" });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.match(mutRes.data.error, /No active workspace has been selected/);

    // Must NOT permit execution without activeWorkspace
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, { command: "node --version" });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.match(execRes.data.error, /No active workspace has been selected/);
  } finally {
    server.close();
  }
});

// TEST 2 — Empty workspaceRoot: {"rootPath": ""} -> REJECTED
test("FAZ 20 - TEST 2: Empty workspaceRoot is REJECTED", async () => {
  const server = createApplicationServer();
  await new Promise(r => server.listen(0, r));

  try {
    const res = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: "" });
    assert.equal(res.status, 400);
    assert.match(res.data.error, new RegExp(ErrorCodes.INVALID_CONTRACT));
  } finally {
    server.close();
  }
});

// TEST 3 — Whitespace workspaceRoot: {"rootPath": "   "} -> REJECTED
test("FAZ 20 - TEST 3: Whitespace workspaceRoot is REJECTED", async () => {
  const server = createApplicationServer();
  await new Promise(r => server.listen(0, r));

  try {
    const res = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: "   " });
    assert.equal(res.status, 400);
    assert.match(res.data.error, new RegExp(ErrorCodes.INVALID_CONTRACT));
  } finally {
    server.close();
  }
});

// TEST 4 — Workspace A -> Workspace B invalidates plan
test("FAZ 20 - TEST 4: Workspace A -> Workspace B invalidates plan (0 writes & 0 executions)", async () => {
  const targetFile = "tmp-faz20-test-4.txt";
  const server = createTestServerWithFileProposal([
    { file: targetFile, content: "PLAN_A_CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceA = process.cwd();
    const tempSubDir = path.join(process.cwd(), "tmp-test-subws-faz20");
    if (!fs.existsSync(tempSubDir)) fs.mkdirSync(tempSubDir, { recursive: true });

    // 1. Select Workspace A
    const ws1Res = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceA });
    assert.equal(ws1Res.status, 200);

    // 2. Create authoritative plan A
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Plan for A" });
    assert.equal(planRes.status, 200);
    const planAId = planRes.data.authoritativePlanId;

    // 3. Switch to Workspace B
    const ws2Res = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: tempSubDir });
    assert.equal(ws2Res.status, 200);

    // 4. Attempt to use old plan A for mutation in new workspace B -> MUST BE BLOCKED
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      planId: planAId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));

    // Verify 0 writes
    const writtenFile = path.join(tempSubDir, targetFile);
    assert.equal(fs.existsSync(writtenFile), false);

    // 5. Attempt to use old plan A for execution in new workspace B -> MUST BE BLOCKED
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));

    if (fs.existsSync(tempSubDir)) fs.rmdirSync(tempSubDir);
  } finally {
    server.close();
  }
});

// TEST 5 — Client workspace tampering (Active A, Client sends B) -> SECURITY_BLOCKED (0 writes, 0 launches)
test("FAZ 20 - TEST 5: Client workspace tampering is SECURITY_BLOCKED with 0 writes & 0 launches", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz20-test-5.txt";
  const provider = createStandardLocalProvider({
    planResolver: () => ({
      intent: "Tampering test",
      analysis: "Test analysis",
      proposedCommands: ["node --version"],
      proposedFileChanges: [targetFile],
      proposedFileMutations: [{ file: targetFile, content: "CONTENT" }],
      riskLevel: "LOW",
      requiresApproval: false
    })
  });
  const gateway = createAIGateway({ providerAdapter: provider });
  const server = createApplicationServer({
    aiGateway: gateway,
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const forgedRoot = "C:\\Forged\\Unauthorized\\Workspace";

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Create plan" });

    // Client attempts to mutate using forged workspaceRoot
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      workspaceRoot: forgedRoot,
      content: "CONTENT",
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));

    // Client attempts to execute command using forged workspaceRoot
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: forgedRoot,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "No process launch permitted on workspace tampering");
  } finally {
    server.close();
  }
});

// TEST 6 — Authoritative plan workspace mismatch is SECURITY_BLOCKED
test("FAZ 20 - TEST 6: Authoritative plan workspace mismatch is SECURITY_BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz20-test-6.txt";
  const server = createTestServerWithFileProposal([
    { file: targetFile, content: "MISMATCH_CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Create plan" });

    // Directly test executeAuthorizedRequest / file mutation when plan workspaceRoot differs from active workspace
    const forgedWorkspace = "C:\\OtherWorkspace";

    const basePlan = createExecutionPlanContract({
      id: "plan-forged-ws",
      taskId: "task-forged-ws",
      expectedCommands: ["node --version"],
      expectedFileChanges: [targetFile],
      risk: "LOW"
    });

    const tamperedPlan = Object.freeze({
      ...basePlan,
      workspaceRoot: forgedWorkspace,
      authoritativeFileMutations: Object.freeze([
        Object.freeze({ file: targetFile, content: "MISMATCH_CONTENT", expectedState: null })
      ])
    });

    // In pipelineRunner, workspaceRoot mismatch against authoritative plan is verified
    assert.throws(
      () => runApplicationPipeline({
        workspaceRoot,
        command: "node --version",
        userApproval: true,
        authoritativePlan: tamperedPlan,
        commandRunner: () => ({ status: 0 })
      }),
      new RegExp(ErrorCodes.SECURITY_BLOCKED)
    );
  } finally {
    server.close();
  }
});

// TEST 7 — Handoff workspace tampering is BLOCKED (0 execution)
test("FAZ 20 - TEST 7: Handoff workspace tampering is BLOCKED", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const validWorkspace = process.cwd();
  const tamperedWorkspace = "C:\\TamperedWorkspace";

  const admission = { id: "adm-ws-t", taskId: "t-ws", planId: "p-ws", decision: "ALLOWED" };
  const auth = {
    id: "auth-ws-t",
    requestId: "req-ws-t",
    taskId: "t-ws",
    planId: "p-ws",
    admissionId: "adm-ws-t",
    handoffId: "h-ws-t",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: validWorkspace,
      expectedCommands: ["node --version"]
    }
  };

  // Tampered handoff reference workingDirectory
  const request = {
    id: "req-ws-t",
    taskId: "t-ws",
    planId: "p-ws",
    admissionId: "adm-ws-t",
    handoffId: "h-ws-t",
    handoffReference: {
      id: "h-ws-t",
      taskId: "t-ws",
      planId: "p-ws",
      admissionId: "adm-ws-t",
      workingDirectory: tamperedWorkspace, // TAMPERED WORKSPACE
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-ws-tamper",
      executionRequest: request,
      authorization: auth,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process may launch when handoff workspace is tampered");
});

// TEST 8 — Authorization workspace tampering is BLOCKED (0 writes)
test("FAZ 20 - TEST 8: Authorization workspace tampering is BLOCKED (0 writes)", () => {
  const validWorkspace = process.cwd();
  const tamperedWorkspace = "C:\\TamperedAuthWorkspace";
  const targetFile = "tmp-faz20-test-8.txt";
  const absoluteTarget = path.join(validWorkspace, targetFile);

  const auth = {
    id: "auth-mut-ws",
    taskId: "task-1",
    planId: "plan-1",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: tamperedWorkspace, // TAMPERED!
      authorizedTarget: absoluteTarget,
      authorizedContent: "CONTENT"
    }
  };

  const request = {
    id: "req-mut-ws",
    taskId: "task-1",
    planId: "plan-1",
    admissionId: "adm-1",
    handoffId: "h-1",
    handoffReference: {
      id: "h-1",
      taskId: "task-1",
      planId: "plan-1",
      admissionId: "adm-1"
    }
  };

  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-tamper-res",
      executionRequest: request,
      authorization: auth,
      workspaceRoot: validWorkspace,
      targetPath: absoluteTarget,
      content: "CONTENT",
      operation: "WRITE"
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(fs.existsSync(absoluteTarget), false);
});

// TEST 9 — Traversal / outside workspace is SECURITY_BLOCKED (0 writes)
test("FAZ 20 - TEST 9: Traversal outside workspace is SECURITY_BLOCKED (0 writes)", async () => {
  const targetOutside = "../outside-workspace-leak.txt";
  const server = createTestServerWithFileProposal([
    { file: targetOutside, content: "LEAK" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteOutside = path.resolve(workspaceRoot, targetOutside);
    if (fs.existsSync(absoluteOutside)) fs.unlinkSync(absoluteOutside);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Outside test" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetOutside,
      content: "LEAK",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteOutside), false, "Traversal must result in 0 disk writes");
  } finally {
    server.close();
  }
});

// TEST 10 — Valid explicit workspace completes full authorized mutation chain
test("FAZ 20 - TEST 10: Valid explicit workspace completes full authorized pipeline (1 mutation)", async () => {
  const targetFile = "tmp-faz20-test-10.txt";
  const authContent = "VALID_EXPLICIT_WORKSPACE_CONTENT";

  const server = createTestServerWithFileProposal([
    { file: targetFile, content: authContent }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    // 1. Explicit workspace selection
    const wsRes = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    assert.equal(wsRes.status, 200);
    assert.equal(wsRes.data.workspace.rootPath, workspaceRoot);

    // 2. Authoritative plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Perform valid mutation" });
    assert.equal(planRes.status, 200);

    // 3. Controlled mutation through full preflight, handoff, authorization
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: authContent,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    assert.equal(mutRes.data.postValidation.success, true);
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), authContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
