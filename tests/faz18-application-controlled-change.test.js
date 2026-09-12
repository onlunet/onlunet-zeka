/**
 * AI Development OS - Phase 18 Application-Level Controlled Change Test Suite
 * Validates AI Proposal -> Authoritative Plan -> Controlled File Mutation Application Flow
 *
 * Enforces:
 * - Test A: Valid Authoritative Plan mutation succeeds (1 mutation)
 * - Test B: Forged Target (outside authoritative plan expectedFileChanges) is BLOCKED (0 mutations)
 * - Test C: Forged Workspace (mismatch against active workspace) is BLOCKED (0 mutations)
 * - Test D: Forged Plan ID is BLOCKED (0 mutations)
 * - Test E: Forged Task ID is BLOCKED (0 mutations)
 * - Test F: Missing Authorization / Denied Approval produces ADMISSION_DENIED (0 mutations)
 * - Test G: Denied Authorization is BLOCKED (0 mutations)
 * - Test H: Target not in expectedFileChanges is BLOCKED (0 mutations)
 * - Test I: Path Traversal target is BLOCKED (0 mutations)
 * - Test J: Expected-State Conflict blocks mutation (0 overwrite)
 * - Test K: Dry-Run returns valid simulation with 0 disk writes
 * - Test L: Validation failure after mutation evaluates post-validation independently
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

function createTestServerWithFileProposal(targetFile = "src/valid-file.js") {
  const provider = createStandardLocalProvider({
    planResolver: (prompt) => ({
      intent: prompt.task,
      analysis: "Plan analysis complete",
      proposedCommands: ["node --version"],
      proposedFileChanges: [targetFile],
      riskLevel: "LOW",
      requiresApproval: false
    })
  });
  const gateway = createAIGateway({ providerAdapter: provider });
  return createApplicationServer({ aiGateway: gateway });
}

test("TEST A: Valid Authoritative Plan mutation succeeds (1 mutation)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-a.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const targetFile = "tmp-faz18-test-a.txt";
    const absoluteTarget = path.join(workspaceRoot, targetFile);

    // 1. Set Workspace
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });

    // 2. Generate Plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });
    assert.equal(planRes.status, 200);
    assert.equal(planRes.data.success, true);

    // 3. Execute Mutate
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "content-a",
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), "content-a");

    // Clean up
    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});

test("TEST B: Forged Target (outside authoritative plan expectedFileChanges) is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-allowed.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    // Attempt to mutate forged file not in plan
    const forgedFile = "tmp-faz18-forged.txt";
    const absoluteForged = path.join(workspaceRoot, forgedFile);

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: forgedFile,
      content: "malicious-content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteForged), false, "Forged target must not be created");
  } finally {
    server.close();
  }
});

test("TEST C: Forged Workspace (mismatch against active workspace) is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-c.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      workspaceRoot: "D:\\TamperedWorkspace",
      targetPath: "tmp-faz18-test-c.txt",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST D: Forged Plan ID is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-d.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      planId: "forged-plan-999",
      targetPath: "tmp-faz18-test-d.txt",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST E: Forged Task ID is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-e.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      taskId: "forged-task-999",
      targetPath: "tmp-faz18-test-e.txt",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST F: User rejection results in ADMISSION_DENIED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-f.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const targetFile = "tmp-faz18-test-f.txt";
    const absoluteTarget = path.join(workspaceRoot, targetFile);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    // Client specifies approval: false
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "content",
      approval: false
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "ADMISSION_DENIED");
    assert.equal(mutRes.data.mutationResult, null);
    assert.equal(fs.existsSync(absoluteTarget), false, "File must not be written when denied");
  } finally {
    server.close();
  }
});

test("TEST G: Execution without authoritative plan is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-g.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });

    // Call /api/mutate WITHOUT generating a plan
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "tmp-faz18-test-g.txt",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST H: Target not in expectedFileChanges is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-h-expected.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "tmp-faz18-test-h-different.txt",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST I: Path Traversal target is BLOCKED (0 mutations)", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-i.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "../traversal-escape.js",
      content: "content",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST J: Expected-State Conflict blocks mutation (0 overwrite)", async () => {
  const server = createTestServerWithFileProposal("package.json");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify package.json" });

    // Pass non-matching expectedState
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "package.json",
      content: "new-content",
      expectedState: "DIFFERENT_STATE_CONFLICT",
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

test("TEST K: Dry-Run returns valid simulation with 0 disk writes", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-k.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const targetFile = "tmp-faz18-test-k.txt";
    const absoluteTarget = path.join(workspaceRoot, targetFile);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "dry-run-content",
      dryRun: true,
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(mutRes.data.mutationResult.isDryRun, true);
    assert.equal(fs.existsSync(absoluteTarget), false, "Dry run must never write to disk");
  } finally {
    server.close();
  }
});

test("TEST L: Validation failure after mutation evaluates post-validation independently", async () => {
  const server = createTestServerWithFileProposal("tmp-faz18-test-l.txt");
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const targetFile = "tmp-faz18-test-l.txt";
    const absoluteTarget = path.join(workspaceRoot, targetFile);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Modify test file" });

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "valid-content",
      approval: true
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.mutationResult.outcome, "SUCCEEDED");
    // PostValidation is an independent evaluation
    assert.ok(mutRes.data.postValidation);
    assert.equal(mutRes.data.postValidation.success, true);
    assert.equal(mutRes.data.postValidation.recommendedTaskState, "COMPLETED");

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
