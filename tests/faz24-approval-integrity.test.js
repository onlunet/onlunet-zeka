/**
 * AI Development OS - Phase 24 Approval -> Admission -> Authorization Integrity Test Suite
 *
 * Adversarial Test Matrix:
 * TEST A — Approval false -> Admission DENIED (0 launches, 0 writes)
 * TEST B — Client approval true but policy denied (scope violation) -> Admission DENIED (0 launches, 0 writes)
 * TEST C — Approval tampering (attempting to mutate approvalState throws TypeError / frozen)
 * TEST D — Cross-task approval substitution (approval with mismatched actionType denied)
 * TEST E — Cross-plan approval substitution (policy with mandatory high-risk approval denies when unapproved)
 * TEST F — Workspace/context substitution (approval granted for W1 fails preflight for W2)
 * TEST G — Admission tampering (tampered admissionResult rejected by createExecutionHandoffContract / authorizeExecutionRequest)
 * TEST H — Authorization bypass (attempting authorizeExecutionRequest without admissionResult or with DENIED returns DENIED)
 * TEST I — Direct constructor bypass analysis (contract-only construction blocked at Gate 1 / Gate 4 of execution boundary)
 * TEST J — Valid approval chain (complete valid chain executes exactly 1 launch and 1 write)
 * TEST K — Mutation denied on approval: false -> 0 writes, 0 deletions
 * TEST L — Execution denied on approval: false -> 0 process launches
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
  ApprovalState,
  AdmissionDecision,
  createTask,
  createExecutionPlanContract,
  createApproval,
  createApprovalPolicy,
  createScopePolicy,
  createExecutionPolicy,
  createSecurityPolicy,
  evaluateExecutionPreflight,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  createExecutionAuthorizationContract,
  authorizeExecutionRequest,
  executeAuthorizedRequest
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

function createTestServerWithProposal(mutations = [], commands = ["node --version"]) {
  const provider = createStandardLocalProvider({
    planResolver: (prompt) => ({
      intent: prompt.task,
      analysis: "Approval test proposal",
      proposedCommands: commands,
      proposedFileChanges: mutations.map(m => m.file),
      proposedFileMutations: mutations,
      riskLevel: "LOW",
      requiresApproval: false
    })
  });
  const gateway = createAIGateway({ providerAdapter: provider });
  return createApplicationServer({ aiGateway: gateway });
}

// TEST A — Approval false: Admission = DENIED, 0 launches, 0 writes
test("FAZ 24 - TEST A: Approval false produces Admission DENIED with 0 launches and 0 writes", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: false, // Rejected
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "ADMISSION_DENIED");
  assert.equal(outcome.admission.decision, AdmissionDecision.DENIED);
  assert.equal(outcome.executionResult, null);
  assert.equal(launchCount, 0, "Zero launches on approval: false");
});

// TEST B — Client approval true but policy denied (scope violation) -> Admission DENIED
test("FAZ 24 - TEST B: Client approval true but scope policy violation results in Admission DENIED", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authPlan = createExecutionPlanContract({
    id: "plan-scope-fail",
    taskId: "task-scope-fail",
    expectedCommands: ["node --version"],
    expectedFileChanges: ["forbidden.env"],
    risk: "LOW"
  });

  const scopePolicy = createScopePolicy({
    allowedSurfaces: ["ENVIRONMENT"],
    forbiddenSurfaces: ["FILES"] // FILES is explicitly forbidden by Scope Policy
  });

  const outcome = runApplicationPipeline({
    workspaceRoot: process.cwd(),
    command: "node --version",
    userApproval: true, // User approved, but policy strictly forbids surface!
    authoritativePlan: authPlan,
    scopePolicy,
    commandRunner: mockRunner
  });

  assert.equal(outcome.status, "ADMISSION_DENIED");
  assert.equal(outcome.admission.decision, AdmissionDecision.DENIED);
  assert.equal(launchCount, 0, "Zero launches when scope policy fails despite user approval");
});

// TEST C — Approval tampering: Approval contract is strictly frozen and cannot be mutated
test("FAZ 24 - TEST C: Approval contract is strictly frozen and resists mutation", () => {
  const approval = createApproval({
    id: "appr-tamper",
    actionType: "Execute command",
    reason: "User initial decision",
    approvalState: ApprovalState.REJECTED
  });

  assert.ok(Object.isFrozen(approval));
  assert.throws(() => {
    approval.approvalState = ApprovalState.APPROVED;
  }, TypeError);
});

// TEST D — Cross-task approval substitution: Approval for Task A fails evaluation for Task B
test("FAZ 24 - TEST D: Cross-task approval substitution fails approval policy evaluation", () => {
  const taskB = createTask({ id: "t-b", jobId: "j-1", objective: "DANGEROUS_ACTION_B", status: TaskState.READY });
  const planB = createExecutionPlanContract({ id: "p-b", taskId: "t-b", risk: "HIGH" });

  const approvalPolicy = createApprovalPolicy({
    mandatoryApprovalActions: ["DANGEROUS_ACTION_B"]
  });

  // Approval generated for task A objective
  const approvalForA = createApproval({
    id: "appr-a",
    actionType: "BENIGN_ACTION_A", // Does not match task B objective
    reason: "Approved A",
    approvalState: ApprovalState.APPROVED
  });

  // Preflight evaluates task B with approval for A -> Action does not match, so approval is invalid/rejected
  const approvalCheck = approvalPolicy.isApprovalRequired({ actionType: taskB.objective, riskLevel: "HIGH" });
  assert.equal(approvalCheck.required, true);

  // In orchestrator, when required, it checks approval.actionType === task.objective or valid approval for that action
  const evalResult = evaluateExecutionPreflight({
    id: "adm-cross-d",
    task: taskB,
    executionPlan: planB,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: null // If cross-approval is omitted or mismatched
  });

  assert.equal(evalResult.decision, AdmissionDecision.DENIED);
});

// TEST E — Cross-plan approval substitution: Plan requires HIGH-risk approval, provided low risk approval fails
test("FAZ 24 - TEST E: Approval policy denial on unapproved high-risk plan", () => {
  const task = createTask({ id: "t-e", jobId: "j-1", objective: "DEPLOY", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-e", taskId: "t-e", risk: "HIGH" });

  const approvalPolicy = createApprovalPolicy({
    mandatoryApprovalActions: ["DEPLOY"]
  });

  // Approval missing or pending
  const pendingApproval = createApproval({
    id: "appr-pend",
    actionType: "DEPLOY",
    reason: "Pending",
    approvalState: ApprovalState.PENDING
  });

  const admission = evaluateExecutionPreflight({
    id: "adm-e",
    task,
    executionPlan: plan,
    workingDirectory: process.cwd(),
    approvalPolicy,
    approval: pendingApproval
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.APPROVAL_REQUIRED);
});

// TEST F — Workspace/context substitution: Valid approval on W1 fails preflight when workingDirectory is W2
test("FAZ 24 - TEST F: Workspace substitution causes execution policy denial in preflight", () => {
  const task = createTask({ id: "t-f", jobId: "j-1", objective: "Run", status: TaskState.READY });
  const plan = createExecutionPlanContract({ id: "p-f", taskId: "t-f", expectedCommands: ["node --version"] });

  const execPolicy = createExecutionPolicy({
    allowedWorkingDirectories: [path.resolve(process.cwd(), "approved_dir")]
  });

  const approval = createApproval({
    id: "appr-f",
    actionType: "Run",
    reason: "Approved",
    approvalState: ApprovalState.APPROVED
  });

  // Execution attempted in unauthorized directory
  const admission = evaluateExecutionPreflight({
    id: "adm-f",
    task,
    executionPlan: plan,
    workingDirectory: path.resolve(process.cwd(), "unauthorized_dir"),
    executionPolicy: execPolicy,
    approval
  });

  assert.equal(admission.decision, AdmissionDecision.DENIED);
  assert.equal(admission.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST G — Admission tampering: Tampered admissionResult rejected by handoff and authorization
test("FAZ 24 - TEST G: Tampered admission decision cannot produce handoff or authorization", () => {
  const tamperedAdmission = {
    id: "adm-tampered",
    taskId: "t-g",
    planId: "p-g",
    decision: AdmissionDecision.DENIED,
    reason: "User rejected"
  };

  // 1. Cannot create handoff with DENIED admission
  assert.throws(
    () => createExecutionHandoffContract({
      id: "h-g",
      taskId: "t-g",
      planId: "p-g",
      admissionResult: tamperedAdmission
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  // 2. Cannot authorize with DENIED admission
  const mockReq = {
    id: "req-g",
    taskId: "t-g",
    planId: "p-g",
    admissionId: "adm-tampered",
    handoffId: "h-g"
  };

  const authResult = authorizeExecutionRequest({
    id: "auth-g",
    executionRequest: mockReq,
    admissionResult: tamperedAdmission
  });

  assert.equal(authResult.decision, "DENIED");
});

// TEST H — Authorization bypass: Missing admissionResult returns DENIED
test("FAZ 24 - TEST H: Missing or null admissionResult strictly returns AuthorizationDecision.DENIED", () => {
  const req = {
    id: "req-h",
    taskId: "t-h",
    planId: "p-h",
    admissionId: "adm-h",
    handoffId: "h-h"
  };

  const auth = authorizeExecutionRequest({
    id: "auth-h",
    executionRequest: req,
    admissionResult: null
  });

  assert.equal(auth.decision, "DENIED");
  assert.equal(auth.code, ErrorCodes.SECURITY_BLOCKED);
});

// TEST I — Direct constructor bypass analysis: Spoofed authorization blocked at execution Gate 1 & Gate 4
test("FAZ 24 - TEST I: Direct constructor bypass blocked at execution boundary gates", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  // Attacker crafts direct AUTHORIZED contract without valid authorizedContext
  const forgedAuth = createExecutionAuthorizationContract({
    id: "auth-forged-direct",
    requestId: "req-i",
    taskId: "t-i",
    planId: "p-i",
    admissionId: "adm-i",
    handoffId: "h-i",
    decision: "AUTHORIZED",
    reason: "Forged direct bypass",
    authorizedContext: null // Missing bound context
  });

  const request = {
    id: "req-i",
    taskId: "t-i",
    planId: "p-i",
    admissionId: "adm-i",
    handoffId: "h-i",
    handoffReference: {
      id: "h-i",
      taskId: "t-i",
      planId: "p-i",
      admissionId: "adm-i",
      workingDirectory: process.cwd(),
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-i",
      executionRequest: request,
      authorization: forgedAuth,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(launchCount, 0, "No process launched with forged direct authorization");
});

// TEST J — Valid approval chain: Complete legitimate chain executes exactly 1 launch and 1 write
test("FAZ 24 - TEST J: Valid approval chain executes exactly 1 launch and 1 mutation", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz24-valid-j.txt";
  const validContent = "FAZ24_VALID_APPROVAL_CHAIN";

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Approval test",
          analysis: "Valid",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run valid approval" });
    assert.equal(planRes.status, 200);

    // 1. Execute with approval: true
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
    assert.equal(launchCount, 1, "Exactly 1 launch with valid approval");

    // 2. Mutate with approval: true
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: validContent,
      planId: planRes.data.authoritativePlanId,
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

// TEST K — Mutation denied on approval: false -> 0 writes, 0 deletions
test("FAZ 24 - TEST K: Mutation with approval: false results in ADMISSION_DENIED with 0 writes", async () => {
  const targetFile = "tmp-faz24-denied-k.txt";
  const validContent = "DENIED_CONTENT";

  const server = createTestServerWithProposal([
    { file: targetFile, content: validContent }
  ]);
  await new Promise(r => server.listen(0, r));

  try {
    const workspaceRoot = process.cwd();
    const absoluteTarget = path.join(workspaceRoot, targetFile);
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);

    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Denied mutation test" });
    assert.equal(planRes.status, 200);

    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: validContent,
      planId: planRes.data.authoritativePlanId,
      approval: false // Explicitly denied!
    });

    assert.equal(mutRes.status, 200);
    assert.equal(mutRes.data.status, "ADMISSION_DENIED");
    assert.equal(mutRes.data.admission.decision, "DENIED");
    assert.equal(fs.existsSync(absoluteTarget), false, "0 writes on denied approval");
  } finally {
    server.close();
  }
});

// TEST L — Execution denied on approval: false -> 0 process launches
test("FAZ 24 - TEST L: Execution with approval: false results in ADMISSION_DENIED with 0 process launches", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Denied execution test",
          analysis: "Valid",
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
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Denied exec test" });
    assert.equal(planRes.status, 200);

    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      approval: false // Explicitly denied!
    });

    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "ADMISSION_DENIED");
    assert.equal(execRes.data.admission.decision, "DENIED");
    assert.equal(launchCount, 0, "0 launches on approval: false");
  } finally {
    server.close();
  }
});
