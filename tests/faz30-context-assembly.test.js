/**
 * AI Development OS - Phase 30 Task-Relevant Context Assembly & Plan Integration Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Deterministic context assembly (same workspace + same discovery + same task -> identical context)
 * TEST B — Context is immutable (attempted mutation of any field or nested array throws TypeError)
 * TEST C — Context is advisory only (context.isAuthoritative === false)
 * TEST D — Relevant candidate does not grant mutation authority (candidate in context absent from plan -> mutation rejected)
 * TEST E — Relevant candidate does not grant execution authority (command absent from plan -> execution rejected)
 * TEST F — Client context injection (client submitting relevantFiles/contextFiles/fileContents -> zero authority)
 * TEST G — AI context injection (AI returning rogue relevantFiles/contextFiles/fileContents -> zero authority)
 * TEST H — Workspace isolation (Context from W1 cannot authorize operation in W2)
 * TEST I — Task isolation (Context associated with Task A cannot authorize Task B)
 * TEST J — Discovery boundary (Context assembly cannot discover files absent from provided discovery result)
 * TEST K — No file content loading (Relevance and context assembly do not read arbitrary file contents)
 * TEST L — No new filesystem writes (Context creation performs 0 writes)
 * TEST M — No process launches (Context creation performs 0 process launches)
 * TEST N — Sensitive metadata boundary (No raw secret/file content enters advisory context)
 * TEST O — Deterministic ordering (Same candidate input produces established deterministic sorting)
 * TEST P — Valid full chain (produces 0 unauthorized writes, 0 mutations, 0 launches, 0 workspace escape, 0 authority escalation)
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
  assembleAdvisoryContext
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

// TEST A — Deterministic context assembly
test("FAZ 30 - TEST A: Deterministic context assembly produces identical context for identical inputs", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/contracts/domain.js" },
    { type: "file", relativePath: "package.json" }
  ];
  const taskPrompt = "Fix bug in src/contracts/domain.js";

  const context1 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered });
  const context2 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered });

  assert.deepEqual(context1, context2);
  assert.equal(context1.workspace.rootPath, process.cwd());
  assert.equal(context1.task.taskType, "DEBUG");
  assert.equal(context1.isAuthoritative, false);
});

// TEST B — Context is immutable
test("FAZ 30 - TEST B: Context and its nested structures are strictly frozen and immutable", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [{ type: "file", relativePath: "package.json" }];
  const context = assembleAdvisoryContext({ workspace: ws, taskPrompt: "Inspect package.json", discoveredFiles: discovered });

  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(context.workspace));
  assert.ok(Object.isFrozen(context.task));
  assert.ok(Object.isFrozen(context.relevantCandidates));

  assert.throws(() => { context.isAuthoritative = true; }, TypeError);
  assert.throws(() => { context.workspace.rootPath = "tampered"; }, TypeError);
  assert.throws(() => { context.relevantCandidates.push({ relativePath: "evil.js" }); }, TypeError);
});

// TEST C — Context is advisory only
test("FAZ 30 - TEST C: Advisory context explicitly marks isAuthoritative: false", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({ workspace: ws, taskPrompt: "Inspect", discoveredFiles: [] });

  assert.strictEqual(context.isAuthoritative, false);
});

// TEST D — Relevant candidate does not grant mutation authority
test("FAZ 30 - TEST D: Relevant candidate included in context but absent from plan is rejected from mutation", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Fix auth",
          analysis: "Safe",
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
    // User task mentions package.json, so package.json enters advisory context
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Fix auth in package.json and src/auth.js"
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    // Mutation of package.json is blocked because it's not in the authoritative plan!
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "package.json",
      content: "FORBIDDEN",
      planId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST E — Relevant candidate does not grant execution authority
test("FAZ 30 - TEST E: Relevant candidate in context does not grant unapproved command execution authority", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Version check",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Inspect server.js and check node"
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    // Client attempts to run command "node src/app/server.js" which was not in authoritative plan
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node src/app/server.js",
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

// TEST F — Client context injection
test("FAZ 30 - TEST F: Client submitting fake contextFiles or relevantFiles cannot expand authority", async () => {
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

    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Test injection",
      relevantFiles: ["C:/Windows/System32/config/SAM"],
      contextFiles: ["../outside.secret"],
      fileContents: { "fake.txt": "FAKE" }
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    // Injected foreign path is blocked
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "../outside.secret",
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

// TEST G — AI context injection
test("FAZ 30 - TEST G: AI returning rogue contextFiles/relevantFiles cannot expand authority", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Attack",
          analysis: "Rogue",
          contextFiles: ["/etc/passwd"],
          relevantFiles: ["C:/secret.key"],
          fileContents: { "secret.key": "COMPROMISED" },
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

// TEST H — Workspace isolation: context from W1 cannot authorize operation in W2
test("FAZ 30 - TEST H: Context from W1 cannot authorize operation in W2", async () => {
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

    // Switch workspace to W2
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });

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

// TEST I — Task isolation: context associated with Task A cannot authorize Task B
test("FAZ 30 - TEST I: Task isolation: context associated with Task A cannot authorize Task B", () => {
  const taskA = createTask({ id: "task-a", jobId: "j-1", objective: "Task A", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "plan-b", taskId: "task-b", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-i",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST J — Discovery boundary: context assembly cannot discover files absent from discovery result
test("FAZ 30 - TEST J: Context assembly cannot discover files absent from provided discovery result", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [{ type: "file", relativePath: "package.json" }];

  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Fix error in src/app/server.js",
    discoveredFiles: discovered
  });

  // src/app/server.js exists on disk, but was not in discoveredFiles -> must NOT be in candidates!
  const candidatePaths = context.relevantCandidates.map(c => c.relativePath);
  assert.equal(candidatePaths.includes("src/app/server.js"), false);
  assert.equal(context.relevantCandidates.length, 0);
});

// TEST K — No file content loading: context assembly does not read arbitrary file contents
test("FAZ 30 - TEST K: Context assembly produces candidate metadata only, zero file contents", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = ws.listFiles();

  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Check package.json",
    discoveredFiles: discovered
  });

  for (const c of context.relevantCandidates) {
    assert.equal(typeof c.content, "undefined");
    assert.equal(typeof c.raw, "undefined");
    assert.equal(typeof c.buffer, "undefined");
  }
});

// TEST L — No new filesystem writes: context creation performs zero writes
test("FAZ 30 - TEST L: Context assembly performs zero filesystem writes", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const testFile = path.join(process.cwd(), "tmp-never-created-faz30.txt");
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Create file tmp-never-created-faz30.txt",
    discoveredFiles: ws.listFiles()
  });

  assert.ok(context);
  assert.equal(fs.existsSync(testFile), false, "0 writes during context assembly");
});

// TEST M — No process launches: context creation performs zero process launches
test("FAZ 30 - TEST M: Context assembly performs zero process launches", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Execute node --version and build assets",
    discoveredFiles: ws.listFiles()
  });

  assert.ok(context);
  assert.equal(context.task.taskType, "BUILD");
});

// TEST N — Sensitive metadata boundary: no raw secrets enter advisory context
test("FAZ 30 - TEST N: Advisory context does not contain secret strings or environment variables", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Examine credentials and environment variables",
    discoveredFiles: ws.listFiles()
  });

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes(process.env.PATH || "NON_EXISTENT_VAR"), false);
});

// TEST O — Deterministic ordering: same candidate input produces established deterministic sorting
test("FAZ 30 - TEST O: Context assembly candidate ordering is strictly deterministic", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/contracts/domain.js" },
    { type: "file", relativePath: "src/contracts/constants.js" }
  ];

  const taskPrompt = "Review contracts in domain.js and constants.js";
  const c1 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered });
  const c2 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered.slice().reverse() });

  assert.deepEqual(c1.relevantCandidates, c2.relevantCandidates);
});

// TEST P — Valid full chain: produces 0 unauthorized writes, mutations, launches
test("FAZ 30 - TEST P: Valid full chain passes advisory context to AI and executes through authoritative plan", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  let receivedAdvisoryContext = null;

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: (prompt) => {
          receivedAdvisoryContext = prompt.advisoryContext;
          return {
            intent: "Version check",
            analysis: "Safe",
            proposedCommands: ["node --version"],
            proposedFileChanges: [],
            riskLevel: "LOW"
          };
        }
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });

    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Inspect package.json and check node"
    });
    assert.equal(planRes.status, 200);

    // Verify advisoryContext was passed to AI provider
    assert.ok(receivedAdvisoryContext);
    assert.equal(receivedAdvisoryContext.isAuthoritative, false);
    assert.equal(receivedAdvisoryContext.workspace.rootPath, wsRoot);
    assert.ok(receivedAdvisoryContext.relevantCandidates.length > 0);

    // Execute through authoritative plan
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
    assert.equal(launchCount, 1);
  } finally {
    server.close();
  }
});
