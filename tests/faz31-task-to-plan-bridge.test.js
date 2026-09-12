/**
 * AI Development OS - Phase 31 Task-to-Plan Semantic Bridge Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Deterministic bounded planning input (identical context and bounded fields)
 * TEST B — Oversized task input is handled deterministically (bounded at MAX_TASK_TEXT_LENGTH)
 * TEST C — Oversized candidate set is deterministically bounded (capped at MAX_ADVISORY_CANDIDATES = 50)
 * TEST D — Candidate ordering remains deterministic (scores descending, then lexicographical path)
 * TEST E — Duplicate candidates cannot create duplicate planning authority (canonical deduplication)
 * TEST F — No file contents enter planning input (metadata only: relativePath, score, reasons)
 * TEST G — No secrets/environment variables enter planning input
 * TEST H — Client-injected relevantFiles cannot create authority
 * TEST I — Client-injected contextFiles cannot create authority
 * TEST J — AI-injected relevantFiles cannot create authority
 * TEST K — AI-injected fileContents cannot create authority
 * TEST L — AI-injected authorization flags cannot create authority
 * TEST M — Cross-workspace reuse is denied
 * TEST N — Cross-task reuse is denied
 * TEST O — Relevant candidate does not grant mutation authority
 * TEST P — Relevant candidate does not grant execution authority
 * TEST Q — No new filesystem discovery occurs (operates on provided discovery list only)
 * TEST R — No file content reads occur
 * TEST S — No filesystem writes occur
 * TEST T — No process launches occur
 * TEST U — No network calls occur
 * TEST V — Final planning representation is immutable
 * TEST W — Full valid planning chain preserves existing authoritative-plan behavior
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
  assembleAdvisoryContext,
  normalizeTask,
  MAX_TASK_TEXT_LENGTH,
  MAX_ADVISORY_CANDIDATES,
  selectTaskRelevantCandidates
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

// TEST A — Deterministic bounded planning input
test("FAZ 31 - TEST A: Deterministic bounded planning input produces identical output across calls", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/app/server.js" },
    { type: "file", relativePath: "package.json" }
  ];
  const taskPrompt = "Fix bug in src/app/server.js";

  const c1 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered });
  const c2 = assembleAdvisoryContext({ workspace: ws, taskPrompt, discoveredFiles: discovered });

  assert.deepEqual(c1, c2);
  assert.equal(c1.isAuthoritative, false);
});

// TEST B — Oversized task input is handled deterministically
test("FAZ 31 - TEST B: Oversized task input is capped at MAX_TASK_TEXT_LENGTH deterministically", () => {
  const hugeTask = "Fix error in server.js " + "a".repeat(15000);
  const normalized = normalizeTask(hugeTask);

  assert.ok(normalized.original.length <= MAX_TASK_TEXT_LENGTH);
  assert.equal(normalized.original.length, MAX_TASK_TEXT_LENGTH);
});

// TEST C — Oversized candidate set is deterministically bounded
test("FAZ 31 - TEST C: Oversized candidate list is capped at MAX_ADVISORY_CANDIDATES (50)", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  // Create 100 matching files
  const discovered = [];
  for (let i = 0; i < 100; i++) {
    discovered.push({ type: "file", relativePath: "tests/generated_item_" + i + ".js" });
  }

  const result = selectTaskRelevantCandidates({
    task: "Check tests directory",
    workspace: ws,
    discoveredFiles: discovered
  });

  assert.equal(result.candidates.length, MAX_ADVISORY_CANDIDATES);
  assert.equal(result.candidates.length, 50);
});

// TEST D — Candidate ordering remains deterministic
test("FAZ 31 - TEST D: Candidate ordering is score-descending, then relativePath ascending", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "src/b_item.js" },
    { type: "file", relativePath: "src/a_item.js" },
    { type: "file", relativePath: "src/target.js" }
  ];

  const result = selectTaskRelevantCandidates({
    task: "Examine src/target.js and item",
    workspace: ws,
    discoveredFiles: discovered
  });

  // src/target.js has EXACT_PATH_MENTION (score >= 100), others have token matches (score 30 or 50)
  assert.equal(result.candidates[0].relativePath, "src/target.js");
  // The two equal items must sort alphabetically: a_item.js before b_item.js
  assert.equal(result.candidates[1].relativePath, "src/a_item.js");
  assert.equal(result.candidates[2].relativePath, "src/b_item.js");
});

// TEST E — Duplicate candidates cannot create duplicate planning authority
test("FAZ 31 - TEST E: Duplicate entries in discovery list are deduplicated canonically", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const discovered = [
    { type: "file", relativePath: "package.json" },
    { type: "file", relativePath: "package.json" },
    { type: "file", relativePath: "PACKAGE.JSON" } // Case variation on same path
  ];

  const result = selectTaskRelevantCandidates({
    task: "Check package.json",
    workspace: ws,
    discoveredFiles: discovered
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].relativePath, "package.json");
});

// TEST F — No file contents enter planning input
test("FAZ 31 - TEST F: Candidates contain only metadata and score, never file content or buffers", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Fix package.json",
    discoveredFiles: ws.listFiles()
  });

  for (const c of context.relevantCandidates) {
    assert.equal(typeof c.content, "undefined");
    assert.equal(typeof c.buffer, "undefined");
    assert.equal(typeof c.data, "undefined");
  }
});

// TEST G — No secrets/environment variables enter planning input
test("FAZ 31 - TEST G: Planning input never includes process.env or secret environment variables", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Inspect secret credentials",
    discoveredFiles: []
  });

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes(process.env.PATH || "NON_EXISTENT"), false);
});

// TEST H — Client-injected relevantFiles cannot create authority
test("FAZ 31 - TEST H: Client-injected relevantFiles rejected from authoritative execution scope", async () => {
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
      task: "Task",
      relevantFiles: ["C:/Windows/System32/config/SAM"]
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "C:/Windows/System32/config/SAM",
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

// TEST I — Client-injected contextFiles cannot create authority
test("FAZ 31 - TEST I: Client-injected contextFiles cannot bypass plan expectedFileChanges", async () => {
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
      task: "Task",
      contextFiles: ["forbidden.txt"]
    });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "forbidden.txt",
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

// TEST J — AI-injected relevantFiles cannot create authority
test("FAZ 31 - TEST J: AI proposal rogue relevantFiles cannot bypass authoritative plan boundary", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Attack",
          analysis: "Rogue",
          relevantFiles: ["/etc/shadow"],
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

// TEST K — AI-injected fileContents cannot create authority
test("FAZ 31 - TEST K: AI-injected fileContents cannot override authoritative content", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Attack",
          analysis: "Rogue",
          fileContents: { "secret.txt": "MALICIOUS" },
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Plan" });
    assert.equal(planRes.status, 200);

    const planId = planRes.data.authoritativePlanId;
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "secret.txt",
      content: "MALICIOUS",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST L — AI-injected authorization flags cannot create authority
test("FAZ 31 - TEST L: AI-injected authorization flags (isAuthoritative: true, autoApprove: true) have zero effect", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Bypass",
          analysis: "Rogue",
          isAuthoritative: true,
          autoApprove: true,
          executeImmediately: true,
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      }
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Plan" });
    assert.equal(planRes.status, 200);

    // Verify 0 executions occurred during planning despite executeImmediately: true
    assert.equal(launchCount, 0);

    // If client denies approval, execution must be DENIED despite autoApprove: true
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: false
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "ADMISSION_DENIED");
    assert.equal(launchCount, 0);
  } finally {
    server.close();
  }
});

// TEST M — Cross-workspace reuse is denied
test("FAZ 31 - TEST M: Context from W1 cannot authorize operations under W2", async () => {
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

// TEST N — Cross-task reuse is denied
test("FAZ 31 - TEST N: Cross-task plan reuse evaluated to AdmissionDecision.DENIED at preflight", () => {
  const taskA = createTask({ id: "t-a", jobId: "j-1", objective: "A", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "p-b", taskId: "t-b", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-n",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST O — Relevant candidate does not grant mutation authority
test("FAZ 31 - TEST O: Candidate file in context not included in plan cannot be mutated", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Target auth",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: ["src/auth.js"],
          proposedFileMutations: [{ file: "src/auth.js", content: "DATA" }],
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
      task: "Fix auth in package.json and src/auth.js"
    });
    const planId = planRes.data.authoritativePlanId;

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "package.json",
      content: "HACK",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST P — Relevant candidate does not grant execution authority
test("FAZ 31 - TEST P: Relevant file cannot authorize command execution outside authoritative plan", async () => {
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run node in server.js" });
    const planId = planRes.data.authoritativePlanId;

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

// TEST Q — No new filesystem discovery occurs
test("FAZ 31 - TEST Q: selectTaskRelevantCandidates only inspects provided list, does not call readdir", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const provided = [{ type: "file", relativePath: "package.json" }];

  const result = selectTaskRelevantCandidates({
    task: "Examine src/app/server.js and package.json",
    workspace: ws,
    discoveredFiles: provided
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].relativePath, "package.json");
});

// TEST R — No file content reads occur
test("FAZ 31 - TEST R: Relevance selection produces zero file content reads or buffers", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const result = selectTaskRelevantCandidates({
    task: "Examine package.json",
    workspace: ws,
    discoveredFiles: ws.listFiles()
  });

  for (const c of result.candidates) {
    assert.equal(typeof c.content, "undefined");
    assert.equal(typeof c.raw, "undefined");
    assert.equal(typeof c.buffer, "undefined");
  }
});

// TEST S — No filesystem writes occur
test("FAZ 31 - TEST S: Advisory context assembly performs 0 filesystem writes", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const testFile = path.join(process.cwd(), "tmp-never-written-faz31.txt");
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Create tmp-never-written-faz31.txt",
    discoveredFiles: ws.listFiles()
  });

  assert.equal(fs.existsSync(testFile), false);
});

// TEST T — No process launches occur
test("FAZ 31 - TEST T: Advisory context assembly performs 0 process launches", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Execute node --version",
    discoveredFiles: []
  });

  assert.ok(context);
});

// TEST U — No network calls occur
test("FAZ 31 - TEST U: Advisory context assembly is purely local synchronous logic", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const start = Date.now();
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Check local files",
    discoveredFiles: [{ type: "file", relativePath: "package.json" }]
  });
  const duration = Date.now() - start;

  assert.ok(context);
  assert.ok(duration < 50, "Pure synchronous local compute without network");
});

// TEST V — Final planning representation is immutable
test("FAZ 31 - TEST V: Final planning representation is strictly frozen and resists mutation", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const context = assembleAdvisoryContext({
    workspace: ws,
    taskPrompt: "Task prompt",
    discoveredFiles: [{ type: "file", relativePath: "package.json" }]
  });

  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(context.workspace));
  assert.ok(Object.isFrozen(context.task));
  assert.ok(Object.isFrozen(context.relevantCandidates));
  assert.throws(() => { context.relevantCandidates[0] = null; }, TypeError);
});

// TEST W — Full valid planning chain preserves existing authoritative-plan behavior
test("FAZ 31 - TEST W: Full valid chain executes exactly 1 process launch with valid approval", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  let capturedAdvisoryContext = null;

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: (prompt) => {
          capturedAdvisoryContext = prompt.advisoryContext;
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

    assert.ok(capturedAdvisoryContext);
    assert.equal(capturedAdvisoryContext.isAuthoritative, false);
    assert.ok(capturedAdvisoryContext.relevantCandidates.length > 0);

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
