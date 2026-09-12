/**
 * AI Development OS - Phase 29 Task Understanding & Deterministic Relevance Selection Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Deterministic task normalization (same task produces identical normalized representation)
 * TEST B — Deterministic task classification (same task produces identical task type)
 * TEST C — Exact filename relevance (task explicitly naming existing file identifies file as candidate)
 * TEST D — Path containment (foreign and traversal paths cannot become candidates)
 * TEST E — Client relevance injection (client-supplied relevantFiles cannot become authoritative)
 * TEST F — AI relevance injection (AI-supplied rogue paths cannot become authoritative context)
 * TEST G — Discovery boundary (relevance selection cannot discover files outside existing discovery result)
 * TEST H — No content loading (relevance selection does not read arbitrary file contents)
 * TEST I — Deterministic ordering (same inputs produce identical candidate ordering)
 * TEST J — Cross-workspace isolation (W1 candidates cannot be reused as authority in W2)
 * TEST K — Relevance != mutation authority (relevant file not in plan remains non-editable)
 * TEST L — Relevance != execution authority (relevant file cannot authorize command execution)
 * TEST M — Context immutability (external modification of relevance results cannot alter authoritative state)
 * TEST N — Empty / irrelevant task (fails safely and returns empty/bounded candidate set rather than guessing broadly)
 * TEST O — Valid complete chain (produces 0 writes, 0 mutations, 0 launches, 0 unauthorized paths)
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
  runApplicationPipeline,
  normalizeTask,
  classifyTaskIntent,
  selectTaskRelevantCandidates,
  TaskIntentCategory
} from "../src/app/index.js";
import {
  ErrorCodes,
  createExecutionPlanContract,
  createTask,
  TaskState
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

// TEST A — Deterministic task normalization
test("FAZ 29 - TEST A: Deterministic task normalization produces identical representations", () => {
  const raw1 = "   Fix  login   validation  in  src/auth.js \t\n";
  const raw2 = "Fix login validation in src/auth.js";

  const norm1 = normalizeTask(raw1);
  const norm2 = normalizeTask(raw2);

  assert.equal(norm1.normalized, norm2.normalized);
  assert.equal(norm1.trimmed, norm2.trimmed);
  assert.deepEqual(norm1.tokens, norm2.tokens);
  assert.ok(Object.isFrozen(norm1));
  assert.ok(Object.isFrozen(norm1.tokens));
});

// TEST B — Deterministic task classification
test("FAZ 29 - TEST B: Deterministic task classification into broad categories", () => {
  assert.equal(classifyTaskIntent("Run test suite for auth"), TaskIntentCategory.TEST);
  assert.equal(classifyTaskIntent("Fix crash when submitting form"), TaskIntentCategory.DEBUG);
  assert.equal(classifyTaskIntent("Update dependencies in package.json"), TaskIntentCategory.MODIFY);
  assert.equal(classifyTaskIntent("Refactor database adapter architecture"), TaskIntentCategory.REFACTOR);
  assert.equal(classifyTaskIntent("Build frontend assets"), TaskIntentCategory.BUILD);
  assert.equal(classifyTaskIntent("Explain how authorization works"), TaskIntentCategory.EXPLAIN);
  assert.equal(classifyTaskIntent("Arbitrary random query here"), TaskIntentCategory.GENERAL);
});

// TEST C — Exact filename relevance
test("FAZ 29 - TEST C: Exact filename in task matches candidate with high score", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/app/workspace.js" },
    { type: "file", relativePath: "src/app/server.js" },
    { type: "file", relativePath: "tests/faz29-task-understanding.test.js" }
  ];

  const result = selectTaskRelevantCandidates({
    task: "Fix error in src/app/workspace.js",
    workspace: ws,
    discoveredFiles: discovered
  });

  assert.equal(result.candidates.length > 0, true);
  assert.equal(result.candidates[0].relativePath, "src/app/workspace.js");
  assert.ok(result.candidates[0].score >= 100);
  assert.ok(result.candidates[0].reasons.includes("EXACT_PATH_MENTION"));
});

// TEST D — Path containment: foreign and traversal paths discarded
test("FAZ 29 - TEST D: Traversal or foreign paths are strictly filtered out of candidates", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discoveredWithAttacks = [
    { type: "file", relativePath: "../outside.txt" },
    { type: "file", relativePath: "C:/Windows/System32/cmd.exe" },
    { type: "file", relativePath: "package.json" }
  ];

  const result = selectTaskRelevantCandidates({
    task: "Check package.json and ../outside.txt",
    workspace: ws,
    discoveredFiles: discoveredWithAttacks
  });

  const paths = result.candidates.map(c => c.relativePath);
  assert.ok(paths.includes("package.json"));
  assert.equal(paths.includes("../outside.txt"), false);
  assert.equal(paths.includes("C:/Windows/System32/cmd.exe"), false);
});

// TEST E — Client relevance injection cannot create authority
test("FAZ 29 - TEST E: Client-supplied relevantFiles cannot create authoritative execution or mutation authority", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Check",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: ["allowed.txt"],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });

    // Client sends spoofed relevantFiles in /api/plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Task",
      relevantFiles: ["C:/Windows/System32/config/SAM", "../secret.txt"]
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    // Client attempts to mutate one of its injected relevantFiles -> BLOCKED
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "../secret.txt",
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

// TEST F — AI relevance injection cannot create authority
test("FAZ 29 - TEST F: AI proposal relevantFiles cannot create authoritative context", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Injected relevance",
          analysis: "Attack",
          relevantFiles: ["/etc/shadow", "C:/secret.key"],
          proposedCommands: [],
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run plan" });
    assert.equal(planRes.status, 200);

    const planId = planRes.data.authoritativePlanId;
    assert.ok(planId);

    // AI proposed /etc/shadow in relevantFiles, but authoritative plan does not allow it
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "/etc/shadow",
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

// TEST G — Discovery boundary: relevance cannot discover files outside existing discovery result
test("FAZ 29 - TEST G: Relevance selection operates only on provided discovery results", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  // Provided discovery array is limited
  const discovered = [
    { type: "file", relativePath: "package.json" }
  ];

  // Even though src/app/server.js exists on disk, it is NOT in the discovery result
  const result = selectTaskRelevantCandidates({
    task: "Fix server.js in src/app/server.js",
    workspace: ws,
    discoveredFiles: discovered
  });

  const paths = result.candidates.map(c => c.relativePath);
  assert.equal(paths.includes("src/app/server.js"), false);
  assert.equal(result.candidates.length, 0);
});

// TEST H — No content loading: relevance does not read file contents
test("FAZ 29 - TEST H: Candidates contain only metadata and scores, zero file contents", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = ws.listFiles();

  const result = selectTaskRelevantCandidates({
    task: "Examine package.json",
    workspace: ws,
    discoveredFiles: discovered
  });

  for (const c of result.candidates) {
    assert.equal(typeof c.content, "undefined");
    assert.equal(typeof c.buffer, "undefined");
    assert.ok(typeof c.score === "number");
  }
});

// TEST I — Deterministic ordering: same inputs produce identical candidate ordering
test("FAZ 29 - TEST I: Deterministic candidate scoring and ordering", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/contracts/domain.js" },
    { type: "file", relativePath: "src/contracts/constants.js" },
    { type: "file", relativePath: "src/app/server.js" }
  ];

  const task = "Review contracts in src/contracts/domain.js";
  const run1 = selectTaskRelevantCandidates({ task, workspace: ws, discoveredFiles: discovered });
  const run2 = selectTaskRelevantCandidates({ task, workspace: ws, discoveredFiles: discovered });

  assert.deepEqual(run1.candidates, run2.candidates);
  assert.equal(run1.candidates[0].relativePath, "src/contracts/domain.js");
});

// TEST J — Cross-workspace isolation: W1 candidates cannot authorize in W2
test("FAZ 29 - TEST J: Relevance candidates from W1 cannot be used to authorize in W2", async () => {
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

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check W1" });
    const planId = planRes.data.authoritativePlanId;

    // Switch to W2
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });

    // Old plan fails in W2
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST K — Relevance != mutation authority: a relevant candidate not in plan is non-editable
test("FAZ 29 - TEST K: A relevant candidate file not in plan.expectedFileChanges remains non-editable", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Fix auth",
          analysis: "Target only auth.js",
          proposedCommands: [],
          proposedFileChanges: ["src/auth.js"], // Only auth.js authorized
          proposedFileMutations: [{ file: "src/auth.js", content: "OK" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Fix auth in package.json and src/auth.js" });
    const planId = planRes.data.authoritativePlanId;

    // package.json was relevant to task mention, but plan did NOT authorize it
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "package.json",
      content: "MUTATION",
      planId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST L — Relevance != execution authority: relevant file cannot authorize command execution
test("FAZ 29 - TEST L: Relevant file selection does not authorize commands not in authoritative plan", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Run version",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run node in test.js" });
    const planId = planRes.data.authoritativePlanId;

    // Attempt to execute unapproved command "node test.js"
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node test.js",
      planId,
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0);
  } finally {
    server.close();
  }
});

// TEST M — Context immutability
test("FAZ 29 - TEST M: External tampering with candidates array throws TypeError", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const result = selectTaskRelevantCandidates({
    task: "Fix package.json",
    workspace: ws,
    discoveredFiles: [{ type: "file", relativePath: "package.json" }]
  });

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.candidates));
  assert.throws(() => {
    result.candidates.push({ relativePath: "injected.js" });
  }, TypeError);
});

// TEST N — Empty / irrelevant task fails safely with empty candidate set
test("FAZ 29 - TEST N: Irrelevant task produces empty candidates rather than guessing broadly", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/contracts/domain.js" },
    { type: "file", relativePath: "package.json" }
  ];

  const result = selectTaskRelevantCandidates({
    task: "Something completely unrelated without matching tokens",
    workspace: ws,
    discoveredFiles: discovered
  });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.taskType, TaskIntentCategory.GENERAL);
  assert.equal(result.isAuthoritative, false);
});

// TEST O — Valid complete chain produces 0 writes, 0 mutations, 0 launches
test("FAZ 29 - TEST O: Valid chain produces 0 process launches and 0 writes", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Advisory chain",
          analysis: "Advisory only",
          proposedCommands: ["node --version"],
          proposedFileChanges: ["tmp-never-written.txt"],
          proposedFileMutations: [{ file: "tmp-never-written.txt", content: "NONE" }],
          riskLevel: "LOW"
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    const targetFile = path.join(wsRoot, "tmp-never-written.txt");
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

    // 1. Workspace
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });

    // 2. Planning with relevance task
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Inspect package.json and prepare advisory plan"
    });
    assert.equal(planRes.status, 200);

    // Verify ZERO launches and ZERO writes during planning
    assert.equal(launchCount, 0);
    assert.equal(fs.existsSync(targetFile), false);
  } finally {
    server.close();
  }
});
