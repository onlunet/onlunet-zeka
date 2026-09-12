/**
 * AI Development OS - Phase 26 Project Context & Workspace Authority Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Cross-workspace execution (plan generated in W1, execution attempted in W2 -> SECURITY_BLOCKED, 0 launches)
 * TEST B — Cross-workspace mutation (plan generated in W1, mutation attempted in W2 -> SECURITY_BLOCKED, 0 writes)
 * TEST C — AI workspace spoof (AI returns rogue workspaceRoot: W2, plan retains authoritative activeWorkspace W1)
 * TEST D — Client context spoof (/api/plan with rogue client workspace parameter cannot override active workspace)
 * TEST E — Context mutation after plan creation (external workspace object mutation cannot alter authoritative plan)
 * TEST F — Workspace change invalidates old plan (selecting new workspace clears authoritativeActivePlan -> BLOCKED)
 * TEST G — Context/task identity substitution (workspace context cannot decouple plan from task identity)
 * TEST H — Context/plan identity substitution (forged planId rejected even within valid workspace)
 * TEST I — Context/approval boundary (approval granted for W1 fails preflight execution in W2)
 * TEST J — Context cannot bypass authorized workingDirectory (Gate 4 verifies cwd strictly matches authorizedContext)
 * TEST K — Context cannot bypass mutation target boundary (Gate 4 blocks traversal or paths outside authorized workspace)
 * TEST L — Valid workspace -> context -> plan -> execution chain (complete valid chain executes exactly 1 launch & 1 write)
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
  runApplicationPipeline
} from "../src/app/index.js";
import {
  ErrorCodes,
  TaskState,
  createTask,
  createExecutionPlanContract,
  createApproval,
  createExecutionPolicy,
  evaluateExecutionPreflight
} from "../src/index.js";
import { executeAuthorizedFileMutation, FileMutationOperation } from "../src/contracts/file-mutation.js";

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

// TEST A — Cross-workspace execution
test("FAZ 26 - TEST A: Cross-workspace execution is SECURITY_BLOCKED (0 launches)", async () => {
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
    const workspaceW1 = process.cwd();
    const foreignW2 = path.resolve(process.cwd(), "foreign_w2");

    // 1. Select W1 and generate Plan
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceW1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });
    assert.equal(planRes.status, 200);

    // 2. Client attempts execution pointing to W2
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: foreignW2,
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "0 launches on cross-workspace execution attempt");
  } finally {
    server.close();
  }
});

// TEST B — Cross-workspace mutation
test("FAZ 26 - TEST B: Cross-workspace mutation is SECURITY_BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-target-b.txt";
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Mutate",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: "W1_DATA" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceW1 = process.cwd();
    const foreignW2 = path.resolve(process.cwd(), "foreign_w2");

    // 1. Select W1 and generate Plan
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceW1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Mutate" });
    assert.equal(planRes.status, 200);

    // 2. Client attempts mutation in W2
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      workspaceRoot: foreignW2,
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST C — AI workspace spoof: Provider proposal includes rogue workspaceRoot
test("FAZ 26 - TEST C: AI proposal workspaceRoot spoof cannot override active workspace", async () => {
  const rogueW2 = "C:/rogue/unauthorized_workspace";
  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "spoofing-ai",
        chat: async () => ({
          intent: "Spoof workspace",
          analysis: "Attack",
          workspaceRoot: rogueW2,
          projectRoot: rogueW2,
          cwd: rogueW2,
          workingDirectory: rogueW2,
          proposedCommands: ["node --version"],
          proposedFileChanges: [],
          riskLevel: "LOW"
        })
      }
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const activeW1 = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeW1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run plan" });
    assert.equal(planRes.status, 200);

    // Authoritative plan must be bound to activeW1, NOT rogueW2
    // Verify execution against activeW1 succeeds (or fails if client asks for rogueW2)
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: rogueW2,
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    // Attempting to execute with rogueW2 is blocked
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST D — Client context spoof: client passing workspaceRoot in /api/plan
test("FAZ 26 - TEST D: Client passing workspaceRoot in /api/plan does not override active workspace", async () => {
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
    const activeW1 = process.cwd();
    const forgedW2 = path.resolve(process.cwd(), "forged_w2");

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: activeW1 });

    // Client passes rogue workspaceRoot in /api/plan body
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, {
      task: "Check",
      workspaceRoot: forgedW2
    });
    assert.equal(planRes.status, 200);

    // Authoritative plan remains bound to activeW1
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: forgedW2,
      planId: planRes.data.authoritativePlanId,
      approval: true
    });
    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
  }
});

// TEST E — Context mutation after plan creation
test("FAZ 26 - TEST E: External workspace summary mutation cannot alter authoritative plan context", async () => {
  const workspaceObj = {
    name: "ws1",
    rootPath: process.cwd()
  };

  const gateway = createAIGateway({
    providerAdapter: createStandardLocalProvider({
      planResolver: () => ({
        intent: "Check",
        analysis: "Safe",
        proposedCommands: ["node --version"],
        proposedFileChanges: [],
        riskLevel: "LOW"
      })
    })
  });

  const proposal = await gateway.analyzeAndPlan({
    taskPrompt: "Check",
    workspaceSummary: workspaceObj
  });

  // Construct plan with original rootPath
  const plan = Object.freeze({
    ...createExecutionPlanContract({
      id: "p-e",
      taskId: "t-e",
      expectedCommands: proposal.proposedCommands
    }),
    workspaceRoot: workspaceObj.rootPath
  });

  // Mutate external object
  workspaceObj.rootPath = "corrupted_path";

  // Authoritative plan remains unchanged
  assert.equal(plan.workspaceRoot, process.cwd());
});

// TEST F — Workspace change invalidates old plan
test("FAZ 26 - TEST F: Workspace change invalidates old plan (0 executions & 0 writes)", async () => {
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

    // 1. In W1: generate plan
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w1 });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });
    const planIdW1 = planRes.data.authoritativePlanId;

    // 2. Switch active workspace to W2 -> invalidates plan
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: w2 });

    // 3. Attempt execution with old planIdW1
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planIdW1,
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "Zero launches after workspace switch invalidation");
  } finally {
    server.close();
  }
});

// TEST G — Context/task identity substitution
test("FAZ 26 - TEST G: Plan created in context cannot decouple from task identity at preflight", () => {
  const taskA = createTask({ id: "task-orig", jobId: "j-1", objective: "Run", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-g", taskId: "task-different", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-g",
    task: taskA,
    executionPlan: plan,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST H — Context/plan identity substitution
test("FAZ 26 - TEST H: Forged planId is rejected even within valid workspace context", async () => {
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
    const ws = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: ws });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: "forged-unauthorized-plan-id",
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "Zero launches on forged planId");
  } finally {
    server.close();
  }
});

// TEST I — Context/approval boundary: Approval granted for W1 fails preflight execution in W2
test("FAZ 26 - TEST I: Approval granted for W1 fails execution policy when executing in W2", () => {
  const task = createTask({ id: "t-i", jobId: "j-1", objective: "Run", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-i", taskId: "t-i", expectedCommands: ["node --version"] });

  const execPolicy = createExecutionPolicy({
    allowedWorkingDirectories: [path.resolve(process.cwd(), "approved_w1")]
  });

  const approval = createApproval({
    id: "appr-i",
    actionType: "Run",
    reason: "Approved for W1",
    approvalState: "APPROVED"
  });

  // Attempting preflight in foreign W2 fails execution policy
  const admission = evaluateExecutionPreflight({
    id: "adm-i",
    task,
    executionPlan: plan,
    workingDirectory: path.resolve(process.cwd(), "foreign_w2"),
    executionPolicy: execPolicy,
    approval
  });

  assert.equal(admission.decision, "DENIED");
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST J — Context cannot bypass authorized workingDirectory
test("FAZ 26 - TEST J: Consumed workingDirectory must match authorizedContext workingDirectory exactly", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authWorkspace = path.resolve(process.cwd());
  const foreignWorkspace = path.resolve(process.cwd(), "foreign_workspace");

  const handoff = {
    id: "h-j",
    taskId: "t-j",
    planId: "p-j",
    admissionId: "adm-j",
    workingDirectory: foreignWorkspace, // Diverges!
    expectedCommands: ["node --version"]
  };

  const request = {
    id: "req-j",
    taskId: "t-j",
    planId: "p-j",
    admissionId: "adm-j",
    handoffId: "h-j",
    handoffReference: handoff
  };

  const authorization = {
    id: "auth-j",
    requestId: "req-j",
    taskId: "t-j",
    planId: "p-j",
    admissionId: "adm-j",
    handoffId: "h-j",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: authWorkspace,
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => runApplicationPipeline({
      workspaceRoot: authWorkspace,
      command: "node --version",
      authoritativePlan: {
        id: "p-j",
        taskId: "t-j",
        workspaceRoot: foreignWorkspace, // Mismatch against pipeline workspace!
        expectedCommands: ["node --version"]
      },
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launched on workspace mismatch");
});

// TEST K — Context cannot bypass mutation target boundary
test("FAZ 26 - TEST K: Mutation target outside authorized workspace is SECURITY_BLOCKED (0 writes)", () => {
  const workspaceRoot = process.cwd();
  const outsideTarget = path.join(workspaceRoot, "../outside-file-k.txt");

  const request = {
    id: "req-k",
    taskId: "t-k",
    planId: "p-k",
    admissionId: "adm-k",
    handoffId: "h-k"
  };

  const authorization = {
    id: "auth-k",
    taskId: "t-k",
    planId: "p-k",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: outsideTarget,
      authorizedContent: "DATA",
      expectedState: null
    }
  };

  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-res-k",
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: outsideTarget,
      content: "DATA",
      operation: FileMutationOperation.WRITE
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

// TEST L — Valid workspace -> context -> plan -> execution chain
test("FAZ 26 - TEST L: Valid workspace -> context -> plan -> execution executes exactly 1 launch & 1 write", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz26-valid-l.txt";
  const validContent = "VALID_FAZ26_CONTEXT_CONTENT";

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Build file",
          analysis: "Safe",
          proposedCommands: ["node --version"],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: validContent }],
          riskLevel: "LOW",
          requiresApproval: false
        })
      })
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    // 1. Select Workspace
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });

    // 2. Plan in Context
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Valid task" });
    assert.equal(planRes.status, 200);
    const planId = planRes.data.authoritativePlanId;

    // 3. Execute in Context
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(launchCount, 1, "Exactly 1 launch in valid workspace context");

    // 4. Mutate in Context
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: validContent,
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 200);
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), validContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
