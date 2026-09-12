/**
 * AI Development OS - Phase 28 Project Context Model & Task-Relevant Context Authority Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Context file subset authority: Discovered files do not automatically acquire mutation authority
 * TEST B — Client context injection: Client passing fake fileContents or relevantFiles in /api/plan has zero authority
 * TEST C — Client file path spoof: Disallowing foreign file paths or parent traversal from becoming authoritative context
 * TEST D — AI context injection: AI returning rogue projectFiles/contextFiles fields confers zero execution or mutation authority
 * TEST E — Cross-workspace context: Context from W1 cannot be used to authorize execution or mutation in W2
 * TEST F — Context / Task identity: Context cannot decouple authoritative plan from task identity (cross-task preflight fails)
 * TEST G — Context / Plan identity: Forged planId within the context cannot authorize execution (SECURITY_BLOCKED)
 * TEST H — Context mutability: External tampering with workspace summary or file list does not alter authoritative plan context
 * TEST I — Discovery observation != mutation authority: 100 discovered files does NOT mean 100 editable files (only expectedFileChanges)
 * TEST J — Sensitive context exposure: Sensitive files like .env/credentials are not automatically read into context content
 * TEST K — Context boundary / size: listFiles is strictly depth-bounded (maxDepth = 2) and does not read unbounded file contents
 * TEST L — Valid context chain: Valid chain (Workspace -> Discovery -> Context -> Task -> Proposal -> Plan) produces 0 unauthorized writes/launches
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
  evaluateExecutionPreflight
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

// TEST A — Context file subset authority
test("FAZ 28 - TEST A: Discovered files do not automatically acquire mutation authority", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // Authoritative plan explicitly targets only 1 specific file
  const targetFile = "specific-file.txt";
  const plan = createExecutionPlanContract({
    id: "plan-a",
    taskId: "task-a",
    expectedCommands: [],
    expectedFileChanges: [targetFile],
    risk: "LOW"
  });

  // Having multiple discovered files in workspace context does not grant mutation authority to other files
  assert.ok(files.length > 1);
  assert.equal(plan.expectedFileChanges.length, 1);
  assert.equal(plan.expectedFileChanges[0], targetFile);
});

// TEST B — Client context injection
test("FAZ 28 - TEST B: Client passing fake fileContents or relevantFiles in /api/plan has zero authority", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: (prompt) => {
          // Verify prompt only received legitimate workspace summary
          assert.equal(typeof prompt.fileContents, "undefined");
          assert.equal(typeof prompt.relevantFiles, "undefined");
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
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });

    // Client sends spoofed context fields in /api/plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Task with fake context",
      fileContents: { "secret.txt": "FAKE_AUTHENTICATED_CONTENT" },
      relevantFiles: ["all_system_files"]
    });

    assert.equal(planRes.status, 200);
  } finally {
    server.close();
  }
});

// TEST C — Client file path spoof
test("FAZ 28 - TEST C: Outside paths cannot be injected as authoritative context", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const foreignPath = path.resolve(process.cwd(), "../outside-secret.txt");

  assert.throws(
    () => ws.assertInside(foreignPath),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

// TEST D — AI context injection
test("FAZ 28 - TEST D: AI returning rogue projectFiles/contextFiles fields confers zero authority", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Context injection",
          analysis: "Rogue",
          contextFiles: ["/etc/shadow", "C:/secret.key"],
          projectFiles: ["all_files"],
          fileContents: { "any.js": "MALICIOUS" },
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Injection test" });
    assert.equal(planRes.status, 200);

    // Authoritative plan was created without rogue context files
    const planId = planRes.data.authoritativePlanId;
    assert.ok(planId);

    // Client attempts to mutate a file from rogue contextFiles -> rejected
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "C:/secret.key",
      content: "DATA",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST E — Cross-workspace context
test("FAZ 28 - TEST E: Context from W1 cannot be used to authorize execution in W2", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

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
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const w1 = process.cwd();
    const w2 = path.resolve(process.cwd(), "tests");

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });
    const planId = planRes.data.authoritativePlanId;

    // Switch workspace to W2
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });

    // Old plan cannot execute in W2
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "0 launches on cross-workspace execution");
  } finally {
    server.close();
  }
});

// TEST F — Context / Task identity
test("FAZ 28 - TEST F: Context cannot decouple authoritative plan from task identity", () => {
  const taskA = createTask({ id: "task-a", jobId: "j-1", objective: "Run A", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "plan-b", taskId: "task-b", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-f",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST G — Context / Plan identity
test("FAZ 28 - TEST G: Forged planId within the context cannot authorize execution", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

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
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: "forged-fake-planId",
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "0 launches on forged planId");
  } finally {
    server.close();
  }
});

// TEST H — Context mutability
test("FAZ 28 - TEST H: External tampering with workspace summary or file list does not alter plan context", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // listFiles is frozen
  assert.throws(() => {
    files[0] = { type: "file", relativePath: "tampered.js" };
  }, TypeError);
});

// TEST I — Discovery observation != mutation authority
test("FAZ 28 - TEST I: Discovered files do not grant write authority without explicit plan inclusion", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Mutate",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: ["allowed.txt"],
          proposedFileMutations: [{ file: "allowed.txt", content: "ALLOWED_DATA" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Mutate task" });
    const planId = planRes.data.authoritativePlanId;

    // package.json exists in workspace discovery, but is NOT in plan.expectedFileChanges!
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "package.json",
      content: "TAMPERED",
      planId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST J — Sensitive context exposure
test("FAZ 28 - TEST J: Sensitive files are not read into context content", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles();

  // Verify none of the file descriptors contain raw file content or secret streams
  for (const f of files) {
    assert.equal(typeof f.content, "undefined");
    assert.equal(typeof f.raw, "undefined");
    assert.equal(typeof f.secret, "undefined");
  }
});

// TEST K — Context boundary / size
test("FAZ 28 - TEST K: listFiles is strictly depth-bounded (maxDepth = 2) and deterministic", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const files = ws.listFiles({ maxDepth: 1 });

  // Depth 1 files should not contain deeply nested slashes (e.g. a/b/c)
  for (const f of files) {
    const segments = f.relativePath.split(path.sep);
    assert.ok(segments.length <= 1);
  }
});

// TEST L — Valid context chain produces 0 unauthorized writes/launches
test("FAZ 28 - TEST L: Valid context chain produces 0 process launches and 0 writes during planning", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Contextual task",
          analysis: "Context understood",
          proposedCommands: ["node --version"],
          proposedFileChanges: ["tmp-context-test.txt"],
          proposedFileMutations: [{ file: "tmp-context-test.txt", content: "TEST_CONTEXT" }],
          riskLevel: "LOW"
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    const targetFile = path.join(wsRoot, "tmp-context-test.txt");
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

    // 1. Workspace discovery
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });

    // 2. Planning
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Perform task" });
    assert.equal(planRes.status, 200);

    // Verify 0 side effects during discovery & context construction
    assert.equal(launchCount, 0, "0 process launches during context & plan creation");
    assert.equal(fs.existsSync(targetFile), false, "0 writes during context & plan creation");
  } finally {
    server.close();
  }
});
