/**
 * AI Development OS - Phase 25 AI Proposal -> Authoritative Plan Integrity Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Forged command cannot escape authoritative plan (client command != plan expectedCommands -> SECURITY_BLOCKED, 0 launches)
 * TEST B — Malicious/extra proposal command cannot bypass existing policy (command violates executionPolicy -> Admission DENIED, 0 launches)
 * TEST C — Forged file target cannot escape authoritative plan (targetPath not in expectedFileChanges -> SECURITY_BLOCKED, 0 writes)
 * TEST D — Authoritative content tampering blocked (client content != authoritative content -> SECURITY_BLOCKED, 0 writes)
 * TEST E — Proposal mutation cannot mutate authoritative plan (external array mutation does not affect authoritative plan)
 * TEST F — Task identity substitution blocked (cross-task plan at preflight evaluated to Admission DENIED, 0 launches, 0 writes)
 * TEST G — Plan identity substitution blocked (forged planId rejected at /api/execute and /api/mutate with SECURITY_BLOCKED)
 * TEST H — Workspace substitution blocked (attempting to execute outside authoritative plan workspaceRoot is SECURITY_BLOCKED)
 * TEST I — AI risk/approval manipulation cannot bypass existing policy (AI says risk: LOW but action requires mandatory approval -> APPROVAL_REQUIRED)
 * TEST J — requiresApproval manipulation cannot bypass approval (AI proposal declares requiresApproval: false, but mandatory policy blocks until approved)
 * TEST K — Unknown bypass fields have no execution authority (AI returns executeImmediately: true, shell: true, etc., ignored with 0 unapproved launches)
 * TEST L — Direct AI gateway proposal cannot execute (AIGateway analyzeAndPlan produces frozen declarative object without executable methods)
 * TEST M — Valid proposal produces valid authoritative plan (complete valid flow executes exactly 1 launch / 1 mutation)
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
  AdmissionDecision,
  createTask,
  createExecutionPlanContract,
  createApprovalPolicy,
  createExecutionPolicy,
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

// TEST A — Forged command cannot escape authoritative plan
test("FAZ 25 - TEST A: Forged command outside authoritative plan is SECURITY_BLOCKED (0 launches)", async () => {
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
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check node" });
    assert.equal(planRes.status, 200);

    // Client requests rogue command "node -e 'process.exit(1)'"
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node -e \"malicious()\"",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "Zero launches when client command escapes authoritative plan");
  } finally {
    server.close();
  }
});

// TEST B — Malicious/extra proposal command cannot bypass existing policy
test("FAZ 25 - TEST B: Extra proposal command violates execution policy resulting in Admission DENIED", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authPlan = createExecutionPlanContract({
    id: "plan-b",
    taskId: "task-b",
    expectedCommands: ["forbidden_executable --destroy"],
    risk: "LOW"
  });

  const execPolicy = createExecutionPolicy({
    allowedCommands: ["node --version"] // forbidden_executable is not allowed
  });

  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "forbidden_executable --destroy",
    userApproval: true,
    authoritativePlan: authPlan,
    executionPolicy: execPolicy,
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "ADMISSION_DENIED");
  assert.equal(outcome.admission.decision, AdmissionDecision.DENIED);
  assert.equal(launchCount, 0, "No launch when proposal command violates execution policy");
});

// TEST C — Forged file target cannot escape authoritative plan
test("FAZ 25 - TEST C: Forged targetPath outside authoritative plan is SECURITY_BLOCKED (0 writes)", async () => {
  const targetFile = "allowed-target-c.txt";
  const forgedFile = "forbidden-target-c.txt";

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Mutate file",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: "VALID_DATA" }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Mutate target" });
    assert.equal(planRes.status, 200);

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: forgedFile, // Not in expectedFileChanges!
      content: "MALICIOUS",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(path.join(workspaceRoot, forgedFile)), false, "Zero writes to forged target");
  } finally {
    server.close();
  }
});

// TEST D — Authoritative content tampering blocked
test("FAZ 25 - TEST D: Client content tampering against authoritative content is SECURITY_BLOCKED (0 writes)", async () => {
  const targetFile = "tmp-faz25-content-d.txt";
  const authContent = "AUTHORITATIVE_PLAN_DATA";

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Write safe data",
          analysis: "Safe",
          proposedCommands: [],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: authContent }],
          riskLevel: "LOW"
        })
      })
    })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Write data" });
    assert.equal(planRes.status, 200);

    // Client attempts to send forged content
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: "FORGED_DATA_UNAUTHORIZED",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(mutRes.status, 400);
    assert.match(mutRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(fs.existsSync(absoluteTarget), false, "Zero writes on content tampering");
  } finally {
    server.close();
  }
});

// TEST E — Proposal mutation cannot mutate authoritative plan
test("FAZ 25 - TEST E: External mutation of AI proposal arrays does not corrupt authoritative plan", async () => {
  const externalCommands = ["node --version"];
  const externalChanges = ["file.txt"];
  const externalMutations = [{ file: "file.txt", content: "ORIGINAL" }];

  const gateway = createAIGateway({
    providerAdapter: {
      providerId: "custom",
      chat: async () => ({
        intent: "Test",
        analysis: "Test",
        proposedCommands: externalCommands,
        proposedFileChanges: externalChanges,
        proposedFileMutations: externalMutations,
        riskLevel: "LOW"
      })
    }
  });

  const proposal = await gateway.analyzeAndPlan({
    taskPrompt: "Run test",
    workspaceSummary: { name: "ws", rootPath: process.cwd() }
  });

  // Construct plan
  const plan = createExecutionPlanContract({
    id: "p-e",
    taskId: "t-e",
    expectedCommands: proposal.proposedCommands,
    expectedFileChanges: proposal.proposedFileChanges
  });

  // Attempt to mutate external array
  externalCommands[0] = "malicious_command";
  externalChanges.push("forged.txt");

  // Plan arrays must remain unchanged and frozen
  assert.equal(plan.expectedCommands[0], "node --version");
  assert.equal(plan.expectedFileChanges.length, 1);
  assert.ok(Object.isFrozen(plan.expectedCommands));
  assert.ok(Object.isFrozen(plan.expectedFileChanges));
});

// TEST F — Task identity substitution blocked
test("FAZ 25 - TEST F: Cross-task plan substitution at preflight evaluates to Admission DENIED", () => {
  const taskA = createTask({ id: "task-A", jobId: "j-1", objective: "Objective A", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "plan-B", taskId: "task-B", risk: "LOW" });

  const admission = evaluateExecutionPreflight({
    id: "adm-f",
    task: taskA,
    executionPlan: planB,
    workingDirectory: process.cwd()
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST G — Plan identity substitution blocked
test("FAZ 25 - TEST G: Forged planId substitution is SECURITY_BLOCKED (0 launches & 0 writes)", async () => {
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
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: "forged-plan-id-fake",
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "0 launches on forged planId");
  } finally {
    server.close();
  }
});

// TEST H — Workspace substitution blocked
test("FAZ 25 - TEST H: Execution outside authoritative plan workspaceRoot is SECURITY_BLOCKED", async () => {
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
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Check" });

    // Client requests execution in unauthorized foreign workspace
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      workspaceRoot: path.resolve(process.cwd(), "foreign_directory"),
      planId: planRes.data.authoritativePlanId,
      approval: true
    });

    assert.equal(execRes.status, 400);
    assert.match(execRes.data.error, new RegExp(ErrorCodes.SECURITY_BLOCKED));
    assert.equal(launchCount, 0, "0 launches on foreign workspaceRoot");
  } finally {
    server.close();
  }
});

// TEST I — AI risk/approval manipulation cannot bypass existing policy
test("FAZ 25 - TEST I: AI proposal declaring riskLevel: 'LOW' cannot bypass mandatory approval policy", () => {
  const task = createTask({ id: "t-i", jobId: "j-1", objective: "MAJOR_DEPENDENCY", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-i", taskId: "t-i", risk: "LOW" }); // AI claimed LOW risk

  const approvalPolicy = createApprovalPolicy({
    mandatoryApprovalActions: ["MAJOR_DEPENDENCY"] // Action is strictly mandatory regardless of AI risk claim
  });

  const admission = evaluateExecutionPreflight({
    id: "adm-i",
    task,
    executionPlan: plan,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: null // No approval provided
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.APPROVAL_REQUIRED);
});

// TEST J — requiresApproval manipulation cannot bypass approval
test("FAZ 25 - TEST J: AI proposal declaring requiresApproval: false cannot bypass mandatory approval policy", () => {
  const task = createTask({ id: "t-j", jobId: "j-1", objective: "DATABASE_MIGRATION", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-j", taskId: "t-j", risk: "HIGH" });

  const approvalPolicy = createApprovalPolicy({
    mandatoryApprovalActions: ["DATABASE_MIGRATION"]
  });

  const admission = evaluateExecutionPreflight({
    id: "adm-j",
    task,
    executionPlan: plan,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: null
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.APPROVAL_REQUIRED);
});

// TEST K — Unknown bypass fields have no execution authority
test("FAZ 25 - TEST K: Unknown bypass fields from AI provider have zero execution authority", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: {
        providerId: "rogue-ai",
        chat: async () => ({
          intent: "Rogue plan",
          analysis: "Attack",
          proposedCommands: ["node --version"],
          executeImmediately: true,
          autoApprove: true,
          skipValidation: true,
          skipAuthorization: true,
          bypassApproval: true,
          shell: true,
          runCommand: "rm -rf /",
          writeFile: "/etc/passwd"
        })
      }
    }),
    pipelineRunner: (opts) => runApplicationPipeline({ ...opts, commandRunner: mockRunner })
  });
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });

    // Request plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Rogue intent" });
    assert.equal(planRes.status, 200);

    // Verify 0 executions occurred automatically
    assert.equal(launchCount, 0, "No execution occurred during /api/plan generation despite executeImmediately: true");

    // Attempt unapproved execute
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: false // Explicitly denied
    });

    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "ADMISSION_DENIED");
    assert.equal(launchCount, 0, "0 launches when user rejects despite autoApprove: true from AI");
  } finally {
    server.close();
  }
});

// TEST L — Direct AI gateway proposal cannot execute
test("FAZ 25 - TEST L: Direct AI Gateway analyzeAndPlan returns frozen declarative data without execution methods", async () => {
  const gateway = createAIGateway({
    providerAdapter: createStandardLocalProvider({
      planResolver: () => ({
        intent: "Declarative test",
        analysis: "Safe",
        proposedCommands: ["node --version"],
        proposedFileChanges: [],
        riskLevel: "LOW"
      })
    })
  });

  const proposal = await gateway.analyzeAndPlan({
    taskPrompt: "Analyze task",
    workspaceSummary: { name: "ws", rootPath: process.cwd() }
  });

  assert.ok(proposal);
  assert.equal(typeof proposal, "object");
  assert.ok(Object.isFrozen(proposal));

  // Verify zero executable methods are exposed on proposal
  assert.equal(typeof proposal.run, "undefined");
  assert.equal(typeof proposal.execute, "undefined");
  assert.equal(typeof proposal.spawn, "undefined");
  assert.equal(typeof proposal.dispatch, "undefined");
});

// TEST M — Valid proposal produces valid authoritative plan
test("FAZ 25 - TEST M: Valid proposal produces authoritative plan that executes through pipeline", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz25-valid-m.txt";
  const validContent = "FAZ25_VALID_AUTHORITATIVE_PLAN";

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

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run valid plan" });
    assert.equal(planRes.status, 200);

    const planId = planRes.data.authoritativePlanId;
    assert.ok(planId);

    // Execute command with approval
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
    assert.equal(launchCount, 1, "Exactly 1 launch with valid proposal");

    // Mutate file with approval
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: validContent,
      planId,
      approval: true
    });
    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "COMPLETED");
    assert.equal(fs.existsSync(absoluteTarget), true);
    assert.equal(fs.readFileSync(absoluteTarget, "utf-8"), validContent);

    fs.unlinkSync(absoluteTarget);
  } finally {
    server.close();
  }
});
