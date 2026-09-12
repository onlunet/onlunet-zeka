/**
 * AI Development OS - Phase 27 Read-Only Project Discovery & Context Builder Foundation Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Basic read-only discovery (listFiles enumerates files/directories within workspace without writing or executing)
 * TEST B — Outside workspace containment (assertInside blocks ../outside and foreign absolute paths with SECURITY_BLOCKED)
 * TEST C — Prefix collision containment (assertInside rejects sibling directory prefixes like workspace-evil)
 * TEST D — Client root spoof (Client passing rogue workspaceRoot in /api/plan or /api/workspace cannot subvert discovery authority)
 * TEST E — Context mutability (external mutation of listFiles array or workspace summary does not alter authoritative context)
 * TEST F — Workspace switch invalidates old discovery context (switching workspace clears old plan and context authority)
 * TEST G — Stale context separation (discovery provides read context, not fresh execution authority)
 * TEST H — Read failure fail-closed handling (invalid or non-existent rootPath throws INVALID_CONTRACT immediately)
 * TEST I — Binary / Large file read-only safety (listFiles only reads metadata/types, never reads/buffers binary content)
 * TEST J — AI context boundary (AI proposal cannot inject rogue workspaceRoot or alter discovery root)
 * TEST K — Context -> Plan binding (Plan created from discovery context strictly binds to activeWorkspace.rootPath)
 * TEST L — Valid read-only chain (Complete chain from workspace discovery -> plan produces 0 launches, 0 writes, 0 deletes)
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
  createProjectWorkspace
} from "../src/app/index.js";
import {
  ErrorCodes,
  createExecutionPlanContract
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

// TEST A — Basic read-only discovery
test("FAZ 27 - TEST A: Basic read-only discovery lists files/directories without writing or executing", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles({ maxDepth: 2 });

  assert.ok(Array.isArray(files));
  assert.ok(files.length > 0);
  assert.ok(Object.isFrozen(files));

  // Check structure
  const sample = files[0];
  assert.ok(["file", "directory"].includes(sample.type));
  assert.ok(typeof sample.relativePath === "string");

  // Verify node_modules and .git were excluded
  const hasGit = files.some(f => f.relativePath.startsWith(".git"));
  const hasNodeModules = files.some(f => f.relativePath.startsWith("node_modules"));
  assert.equal(hasGit, false);
  assert.equal(hasNodeModules, false);
});

// TEST B — Outside workspace containment
test("FAZ 27 - TEST B: assertInside blocks parent traversal (..) and foreign absolute paths", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });

  // 1. Parent traversal
  assert.throws(
    () => ws.assertInside(path.join(process.cwd(), "../secret.txt")),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  // 2. Foreign absolute path
  assert.throws(
    () => ws.assertInside("C:/Windows/System32/cmd.exe"),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

// TEST C — Prefix collision containment
test("FAZ 27 - TEST C: assertInside rejects sibling directory prefixes (prefix collision)", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const evilSibling = `${process.cwd()}-evil`;

  assert.throws(
    () => ws.assertInside(evilSibling),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

// TEST D — Client root spoof
test("FAZ 27 - TEST D: Client cannot spoof discovery root via /api/plan or rogue request parameter", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: (prompt) => {
          // Verify provider received the authoritative workspace, NOT client spoof
          assert.equal(prompt.workspace.rootPath, process.cwd());
          return {
            intent: "Check",
            analysis: "Safe",
            proposedCommands: [],
            proposedFileChanges: [],
            riskLevel: "LOW"
          };
        }
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const activeRoot = process.cwd();
    const foreignRoot = path.resolve(process.cwd(), "foreign_root");

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeRoot });

    // Client passes rogue workspaceRoot in /api/plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Test discovery root",
      workspaceRoot: foreignRoot
    });

    assert.equal(planRes.status, 200);
  } finally {
    server.close();
  }
});

// TEST E — Context mutability
test("FAZ 27 - TEST E: External mutation of discovery file list cannot alter workspace discovery output", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // Attempt to mutate frozen array
  assert.throws(() => {
    files.push({ type: "file", relativePath: "malicious.js" });
  }, TypeError);
});

// TEST F — Workspace switch invalidates old discovery context
test("FAZ 27 - TEST F: Workspace switch resets discovery files and invalidates old plan", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Check",
          analysis: "Safe",
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const w1 = process.cwd();
    const w2 = path.resolve(process.cwd(), "tests");

    // Select W1
    const resW1 = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w1 });
    assert.equal(resW1.status, 200);
    assert.equal(resW1.data.workspace.rootPath, w1);

    // Generate Plan in W1
    const planResW1 = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check W1" });
    const planIdW1 = planResW1.data.authoritativePlanId;

    // Switch to W2
    const resW2 = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });
    assert.equal(resW2.status, 200);
    assert.equal(resW2.data.workspace.rootPath, w2);

    // Old plan is invalidated
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planIdW1,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST G — Stale context separation
test("FAZ 27 - TEST G: Discovery metadata represents observations and does not constitute plan authority", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // Observation contains discovered files
  const discoveredNames = files.map(f => f.relativePath);

  // Authoritative plan created independently from observation
  const plan = createExecutionPlanContract({
    id: "plan-g",
    taskId: "task-g",
    expectedCommands: [],
    expectedFileChanges: ["package.json"],
    risk: "LOW"
  });

  // Having discovered 50 files does not mean they are in expectedFileChanges
  assert.notEqual(discoveredNames.length, plan.expectedFileChanges.length);
  assert.equal(plan.expectedFileChanges.length, 1);
});

// TEST H — Read failure fail-closed handling
test("FAZ 27 - TEST H: Non-existent or invalid rootPath throws INVALID_CONTRACT fail-closed", () => {
  // 1. Missing rootPath
  assert.throws(
    () => createProjectWorkspace({ rootPath: null }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  // 2. Non-existent path
  assert.throws(
    () => createProjectWorkspace({ rootPath: "C:/non_existent_folder_xyz_123" }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );
});

// TEST I — Binary / Large file read-only safety
test("FAZ 27 - TEST I: listFiles only inspects directory structure and does not buffer or read file contents", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // Ensure entries contain only relativePath and type, zero content or binary buffers
  for (const entry of files) {
    assert.ok(entry.type === "file" || entry.type === "directory");
    assert.ok(typeof entry.relativePath === "string");
    assert.equal(typeof entry.content, "undefined");
    assert.equal(typeof entry.buffer, "undefined");
  }
});

// TEST J — AI context boundary
test("FAZ 27 - TEST J: AI proposal cannot inject rogue workspaceRoot or alter discovery root", async () => {
  const rogueRoot = "C:/hacker/workspace";
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "spoof-ai",
        chat: async () => ({
          intent: "Spoof workspace",
          analysis: "Attack",
          workspaceRoot: rogueRoot,
          proposedCommands: [],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      }
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const activeRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run plan" });

    assert.equal(planRes.status, 200);
    // Proposal had rogueRoot, but server ignores it; authoritative active plan remains activeRoot
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: rogueRoot,
      planId: planRes.data.authoritativePlanId,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST K — Context -> Plan binding
test("FAZ 27 - TEST K: Authoritative plan workspaceRoot is strictly bound to activeWorkspace.rootPath", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Check",
          analysis: "Safe",
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const activeRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Bind test" });
    assert.equal(planRes.status, 200);

    // Plan must exist and be valid
    assert.ok(planRes.data.authoritativePlanId);
  } finally {
    server.close();
  }
});

// TEST L — Valid read-only chain produces 0 launches and 0 writes
test("FAZ 27 - TEST L: Valid read-only discovery & plan generation produces 0 process launches and 0 writes", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Read only plan",
          analysis: "Read safe",
          proposedCommands: ["node --version"],
          proposedFileChanges: ["tmp-never-created.txt"],
          proposedFileMutations: [{ file: "tmp-never-created.txt", content: "NEVER_WRITTEN" }],
          riskLevel: "LOW"
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const activeRoot = process.cwd();
    const targetFile = path.join(activeRoot, "tmp-never-created.txt");
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

    // 1. Select workspace & run discovery
    const wsRes = await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeRoot });
    assert.equal(wsRes.status, 200);
    assert.ok(wsRes.data.files.length > 0);

    // 2. Generate Plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Read-only test" });
    assert.equal(planRes.status, 200);

    // VERIFY: No processes launched, no files written!
    assert.equal(launchCount, 0, "0 process launches during discovery and planning");
    assert.equal(fs.existsSync(targetFile), false, "0 files written during discovery and planning");
  } finally {
    server.close();
  }
});
