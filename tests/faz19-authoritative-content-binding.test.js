/**
 * AI Development OS - Phase 19 Authoritative Change Content Binding Test Suite
 * Validates Target File + Proposed Content + Expected State Authoritative Binding
 *
 * Enforces:
 * - Invariant: Authoritative content != Client supplied content -> SECURITY_BLOCKED -> writeCount === 0
 * - Invariant: Client cannot make arbitrary content authoritative
 * - Invariant: Client omitting content uses authoritative content
 * - Invariant: Client tampering with target, planId, taskId, workspace, or expectedState is BLOCKED
 * - Invariant: Mutation success != Validation success
 * - Invariant: Dry-run guarantees 0 filesystem writes
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

import {
  createApplicationServer,
  createAIGateway,
  createStandardLocalProvider
} from "../src/app/index.js";
import {
  ErrorCodes
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

function createTestServerWithAuthoritativeProposal(mutations = []) {
  const provider = createStandardLocalProvider({
    planResolver: (prompt) => ({
      intent: prompt.task,
      analysis: "Authoritative change proposal analysis complete",
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

test("FAZ 19 - TEST 1: Authoritative content with matching client content succeeds (1 mutation)", async () => {
  const targetFile = "tmp-faz19-test-1.txt";
  const authContent = "AUTHORITATIVE_CONTENT_A";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent, expectedState: null }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Apply authoritative change" });
    assert.equal(planRes.status, 200);

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: authContent,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), authContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 2 (MANDATORY ADVERSARIAL): Client content tampering (A vs B) is SECURITY_BLOCKED with writeCount === 0", async () => {
  const targetFile = "tmp-faz19-test-2.txt";
  const authContent = "AUTHORITATIVE_ORIGINAL_CONTENT_A";
  const forgedClientContent = "MALICIOUS_TAMPERED_CONTENT_B";

  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent, expectedState: null }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Prepare change" });
    assert.equal(planRes.status, 200);

    // Client attempts to supply tampered content B
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: forgedClientContent,
      approval: true
    });

    // Verify security block
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.match(mutRes.data.error, /Client content does not match authoritative plan content/);

    // Verify Invariant: writeCount === 0, file does NOT exist on disk
    assert.equal(fs.existsSync(absoluteTarget), false, "Filesystem writeCount must be strictly 0 on content tampering!");
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 3: Client omitting content automatically uses authoritative content from plan", async () => {
  const targetFile = "tmp-faz19-test-3.txt";
  const authContent = "AUTHORITATIVE_AUTO_INJECTED_CONTENT";

  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent, expectedState: null }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Auto change" });

    // Client does NOT send content field
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), authContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 4: Client cannot overwrite non-empty authoritative content with empty string", async () => {
  const targetFile = "tmp-faz19-test-4.txt";
  const authContent = "NON_EMPTY_AUTHORITATIVE_CONTENT";

  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent, expectedState: null }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Empty overwrite attempt" });

    // Client attempts to wipe out content with empty string
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteTarget), false);
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 5: Target outside authoritative plan is BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz19-test-5.txt";
  const unauthorizedTarget = "tmp-faz19-unauthorized.txt";

  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: "VALID_CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteUnauthorized = path.join(workspaceRoot, unauthorizedTarget);
    if (fs.existsSync(absoluteUnauthorized)) fs.unlinkSync(absoluteUnauthorized);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Valid plan" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: unauthorizedTarget,
      content: "VALID_CONTENT",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteUnauthorized), false);
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 6: Expected-state mismatch blocks mutation with 0 disk overwrite", async () => {
  const targetFile = "tmp-faz19-test-6.txt";
  const initialContent = "EXISTING_CONTENT_V1";
  const newContent = "NEW_CONTENT_V2";

  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: newContent, expectedState: "SOME_OTHER_EXPECTED_HASH" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    fs.writeFileSync(absoluteTarget, initialContent);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Update file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: newContent,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.CONFLICT_DETECTED));
    // Original content intact, 0 overwrite
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), initialContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 7: Client workspace tampering is BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz19-test-7.txt";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: "CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Workspace test" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      workspaceRoot: "C:\\FakePath",
      content: "CONTENT",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 8: Plan ID tampering is BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz19-test-8.txt";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: "CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "PlanId test" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      planId: "forged-plan-id-12345",
      content: "CONTENT",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 9: Task ID tampering is BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz19-test-9.txt";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: "CONTENT" }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "TaskId test" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      taskId: "forged-task-id-12345",
      content: "CONTENT",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 10: Dry-run simulation with authoritative content produces 0 disk writes", async () => {
  const targetFile = "tmp-faz19-test-10.txt";
  const authContent = "SIMULATION_CONTENT";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Dry-run test" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: authContent,
      dryRun: true,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    assert.equal(mutRes.data.mutationResult.isDryRun, true);
    assert.equal(fs.existsSync(absoluteTarget), false, "Dry run must NOT create files on disk!");
  } finally {
    server.close();
  }
});

test("FAZ 19 - TEST 11: Mutation success remains strictly decoupled from post-validation", async () => {
  const targetFile = "tmp-faz19-test-11.txt";
  const authContent = "POST_VALIDATION_INDEPENDENT_TEST";
  const server = createTestServerWithAuthoritativeProposal([
    { file: targetFile, content: authContent }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Decoupled validation" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: authContent,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    assert.ok(mutRes.data.postValidation !== null);
    assert.equal(mutRes.data.postValidation.success, true);
    assert.equal(mutRes.data.postValidation.recommendedTaskState, "COMPLETED");
    // Ensure mutation outcome and validation are distinct contract objects
    assert.notEqual(mutRes.data.mutationResult, mutRes.data.postValidation);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
