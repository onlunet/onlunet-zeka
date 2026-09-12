/**
 * AI Development OS - Phase 22 Authorization Context Integrity Test Suite
 * Validates Execution & Mutation Authorization Context Integrity:
 *
 * TEST A — Forged command after authorization (node --version -> whoami) -> BLOCKED (0 launches)
 * TEST B — Forged workingDirectory after authorization -> BLOCKED (0 launches)
 * TEST C — authorizedContext mutation after authorization snapshot -> Throws / Immutable
 * TEST D — expectedCommands array tampering after authorization -> Original command conserved (0 rogue launches)
 * TEST E — Forged mutation target -> BLOCKED (0 writes)
 * TEST F — Forged content against authorizedContent -> SECURITY_BLOCKED (0 writes)
 * TEST G — Forged expectedState against authorized expectedState -> SECURITY_BLOCKED (0 writes)
 * TEST H — Target traversal outside authorized workspace -> SECURITY_BLOCKED (0 writes)
 * TEST I — Cross-context substitution (valid auth with swapped request/handoff) -> BLOCKED (0 launches)
 * TEST J — Valid authorized context -> Exactly 1 launch / 1 write PASS
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
  evaluateExecutionPreflight,
  createExecutionHandoffContract,
  consumeExecutionHandoff,
  createExecutionAuthorizationContract,
  authorizeExecutionRequest,
  executeAuthorizedRequest
} from "../src/index.js";
import {
  executeAuthorizedFileMutation,
  FileMutationOperation
} from "../src/contracts/file-mutation.js";

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

// TEST A — Forged command after authorization: Authorized for 'node --version', executed with 'whoami'
test("FAZ 22 - TEST A: Forged command after authorization is BLOCKED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const workspaceRoot = process.cwd();
  const handoffLegit = {
    id: "h-legit",
    taskId: "t-1",
    planId: "p-1",
    admissionId: "adm-1",
    workingDirectory: workspaceRoot,
    expectedCommands: ["node --version"]
  };

  const request = {
    id: "req-1",
    taskId: "t-1",
    planId: "p-1",
    admissionId: "adm-1",
    handoffId: "h-legit",
    handoffReference: handoffLegit
  };

  // Authorization bound to 'node --version'
  const authorization = {
    id: "auth-1",
    requestId: "req-1",
    taskId: "t-1",
    planId: "p-1",
    admissionId: "adm-1",
    handoffId: "h-legit",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      expectedCommands: ["node --version"]
    }
  };

  // Tampered request handoffReference with 'whoami'
  const tamperedRequest = {
    ...request,
    handoffReference: {
      ...handoffLegit,
      expectedCommands: ["whoami"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-1",
      executionRequest: tamperedRequest,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
  assert.equal(launchCount, 0, "No process launched for forged command");
});

// TEST B — Forged workingDirectory: Authorized for W1, executed in W2
test("FAZ 22 - TEST B: Forged workingDirectory after authorization is BLOCKED (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const authWorkspace = path.resolve(process.cwd());
  const forgedWorkspace = path.resolve(process.cwd(), "unauthorized_subdir");

  const handoff = {
    id: "h-2",
    taskId: "t-2",
    planId: "p-2",
    admissionId: "adm-2",
    workingDirectory: forgedWorkspace, // Diverges from authorizedContext!
    expectedCommands: ["node --version"]
  };

  const request = {
    id: "req-2",
    taskId: "t-2",
    planId: "p-2",
    admissionId: "adm-2",
    handoffId: "h-2",
    handoffReference: handoff
  };

  const authorization = {
    id: "auth-2",
    requestId: "req-2",
    taskId: "t-2",
    planId: "p-2",
    admissionId: "adm-2",
    handoffId: "h-2",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: authWorkspace,
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-2",
      executionRequest: request,
      authorization,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
  assert.equal(launchCount, 0, "No process launched for forged workingDirectory");
});

// TEST C — authorizedContext mutation: Object is strictly frozen against tampering
test("FAZ 22 - TEST C: authorizedContext is strictly frozen and resists mutation", () => {
  const authorization = createExecutionAuthorizationContract({
    id: "auth-immut",
    requestId: "req-immut",
    taskId: "task-immut",
    planId: "plan-immut",
    admissionId: "adm-immut",
    handoffId: "h-immut",
    decision: "AUTHORIZED",
    reason: "Valid test",
    authorizedContext: {
      workingDirectory: process.cwd(),
      expectedCommands: ["node --version"]
    }
  });

  assert.ok(Object.isFrozen(authorization));
  assert.ok(Object.isFrozen(authorization.authorizedContext));
  assert.ok(Object.isFrozen(authorization.authorizedContext.expectedCommands));

  // Attempting to mutate throws TypeError in strict mode
  assert.throws(() => {
    authorization.authorizedContext.workingDirectory = "corrupted-dir";
  }, TypeError);

  assert.throws(() => {
    authorization.authorizedContext.expectedCommands.push("malicious-command");
  }, TypeError);
});

// TEST D — expectedCommands array tampering: External source array mutation does NOT alter authorization snapshot
test("FAZ 22 - TEST D: External source array mutation does not alter authorized snapshot", () => {
  let executedCommand = null;
  const mockRunner = (cmd, args) => {
    executedCommand = (cmd + " " + (args || []).join(" ")).trim();
    return { status: 0 };
  };

  const externalCmds = ["node --version"];
  const authorization = createExecutionAuthorizationContract({
    id: "auth-d",
    requestId: "req-d",
    taskId: "task-d",
    planId: "plan-d",
    admissionId: "adm-d",
    handoffId: "h-d",
    decision: "AUTHORIZED",
    reason: "Valid",
    authorizedContext: {
      workingDirectory: process.cwd(),
      expectedCommands: externalCmds
    }
  });

  // Attacker mutates original array reference
  externalCmds[0] = "malicious-cmd --destroy";

  // Authorization must retain defensive copy
  assert.equal(authorization.authorizedContext.expectedCommands[0], "node --version");

  const handoff = {
    id: "h-d",
    taskId: "task-d",
    planId: "plan-d",
    admissionId: "adm-d",
    workingDirectory: process.cwd(),
    expectedCommands: ["node --version"]
  };
  const request = {
    id: "req-d",
    taskId: "task-d",
    planId: "plan-d",
    admissionId: "adm-d",
    handoffId: "h-d",
    handoffReference: handoff
  };

  executeAuthorizedRequest({
    resultId: "res-d",
    executionRequest: request,
    authorization,
    commandRunner: mockRunner
  });

  assert.equal(executedCommand, "node --version");
});

// TEST E — Forged mutation target: Authorized for fileA, mutation called for fileB -> BLOCKED (0 writes)
test("FAZ 22 - TEST E: Forged mutation target is BLOCKED with 0 disk writes", () => {
  const workspaceRoot = process.cwd();
  const fileA = path.join(workspaceRoot, "tmp-faz22-target-a.txt");
  const fileB = path.join(workspaceRoot, "tmp-faz22-target-b.txt");

  if (fs.existsSync(fileA)) fs.unlinkSync(fileA);
  if (fs.existsSync(fileB)) fs.unlinkSync(fileB);

  const request = {
    id: "req-e",
    taskId: "task-e",
    planId: "plan-e",
    admissionId: "adm-e",
    handoffId: "h-e"
  };

  const authorization = {
    id: "auth-e",
    taskId: "task-e",
    planId: "plan-e",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: fileA,
      authorizedContent: "DATA",
      expectedState: null
    }
  };

  // Mutation called targeting fileB -> BLOCKED
  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-res-e",
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: fileB,
      content: "DATA",
      operation: FileMutationOperation.WRITE
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(fs.existsSync(fileA), false, "0 writes to fileA");
  assert.equal(fs.existsSync(fileB), false, "0 writes to fileB");
});

// TEST F — Forged content: Authoritative content != Provided content -> SECURITY_BLOCKED (0 writes)
test("FAZ 22 - TEST F: Forged content against authorizedContent is SECURITY_BLOCKED (0 writes)", () => {
  const workspaceRoot = process.cwd();
  const targetFile = path.join(workspaceRoot, "tmp-faz22-content-f.txt");
  if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

  const request = {
    id: "req-f",
    taskId: "task-f",
    planId: "plan-f",
    admissionId: "adm-f",
    handoffId: "h-f"
  };

  const authorization = {
    id: "auth-f",
    taskId: "task-f",
    planId: "plan-f",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: targetFile,
      authorizedContent: "AUTHORITATIVE_CONTENT_F",
      expectedState: null
    }
  };

  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-res-f",
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: targetFile,
      content: "FORGED_CONTENT_MALICIOUS",
      operation: FileMutationOperation.WRITE
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );

  assert.equal(fs.existsSync(targetFile), false, "0 writes on content tampering");
});

// TEST G — Forged expectedState: Caller expectedState != Authorized expectedState / Current state -> SECURITY_BLOCKED (0 writes)
test("FAZ 22 - TEST G: Expected-state mismatch against authorized expectedState is SECURITY_BLOCKED (0 writes)", () => {
  const workspaceRoot = process.cwd();
  const targetFile = path.join(workspaceRoot, "tmp-faz22-state-g.txt");
  fs.writeFileSync(targetFile, "CURRENT_VERSION_1", "utf-8");

  try {
    const request = {
      id: "req-g",
      taskId: "task-g",
      planId: "plan-g",
      admissionId: "adm-g",
      handoffId: "h-g"
    };

    // Authorized expectedState specifies "CURRENT_VERSION_1"
    const authorization = {
      id: "auth-g",
      taskId: "task-g",
      planId: "plan-g",
      decision: "AUTHORIZED",
      authorizedContext: {
        workingDirectory: workspaceRoot,
        authorizedTarget: targetFile,
        authorizedContent: "NEW_VERSION_2",
        expectedState: "DIFFERENT_STATE_STALE" // Does not match current state!
      }
    };

    assert.throws(
      () => executeAuthorizedFileMutation({
        resultId: "mut-res-g",
        executionRequest: request,
        authorization,
        workspaceRoot,
        targetPath: targetFile,
        content: "NEW_VERSION_2",
        operation: FileMutationOperation.WRITE
      }),
      new RegExp(ErrorCodes.SECURITY_BLOCKED)
    );

    assert.equal(fs.readFileSync(targetFile, "utf-8"), "CURRENT_VERSION_1", "File unchanged after expected-state conflict");
  } finally {
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
  }
});

// TEST H — Target traversal: Path traversal '../outside.txt' -> SECURITY_BLOCKED (0 writes)
test("FAZ 22 - TEST H: Target traversal outside authorized workspace is SECURITY_BLOCKED (0 writes)", () => {
  const workspaceRoot = process.cwd();
  const traversalTarget = path.join(workspaceRoot, "../traversal-outside-faz22.txt");

  const request = {
    id: "req-h",
    taskId: "task-h",
    planId: "plan-h",
    admissionId: "adm-h",
    handoffId: "h-h"
  };

  const authorization = {
    id: "auth-h",
    taskId: "task-h",
    planId: "plan-h",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      authorizedTarget: traversalTarget,
      authorizedContent: "DATA",
      expectedState: null
    }
  };

  assert.throws(
    () => executeAuthorizedFileMutation({
      resultId: "mut-res-h",
      executionRequest: request,
      authorization,
      workspaceRoot,
      targetPath: traversalTarget,
      content: "DATA",
      operation: FileMutationOperation.WRITE
    }),
    new RegExp(ErrorCodes.SECURITY_BLOCKED)
  );
});

// TEST I — Cross-context substitution: Swapping request / handoff reference against valid authorization -> BLOCKED (0 launches)
test("FAZ 22 - TEST I: Cross-context substitution is BLOCKED at execution boundary (0 launches)", () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const workspaceRoot = process.cwd();

  // Valid Authorization for Context A
  const authorizationA = {
    id: "auth-a",
    requestId: "req-a",
    taskId: "task-a",
    planId: "plan-a",
    admissionId: "adm-a",
    handoffId: "h-a",
    decision: "AUTHORIZED",
    authorizedContext: {
      workingDirectory: workspaceRoot,
      expectedCommands: ["node --version"]
    }
  };

  // Swapped Request B (cross-context)
  const swappedRequestB = {
    id: "req-b",
    taskId: "task-b", // Mismatched!
    planId: "plan-a",
    admissionId: "adm-a",
    handoffId: "h-a",
    handoffReference: {
      id: "h-a",
      taskId: "task-a",
      planId: "plan-a",
      admissionId: "adm-a",
      workingDirectory: workspaceRoot,
      expectedCommands: ["node --version"]
    }
  };

  assert.throws(
    () => executeAuthorizedRequest({
      resultId: "res-cross",
      executionRequest: swappedRequestB,
      authorization: authorizationA,
      commandRunner: mockRunner
    }),
    new RegExp(ErrorCodes.INVALID_CONTRACT)
  );

  assert.equal(launchCount, 0, "No process launched on cross-context substitution");
});

// TEST J — Valid authorized context: Complete legitimate execution and mutation succeed (exactly 1 launch & 1 write)
test("FAZ 22 - TEST J: Valid authorized context executes exactly 1 launch and 1 write", async () => {
  let launchCount = 0;
  const mockRunner = () => { launchCount++; return { status: 0 }; };

  const targetFile = "tmp-faz22-valid-j.txt";
  const validContent = "VALID_FAZ22_AUTHORIZED_CONTENT";

  const server = createApplicationServer({
    aiGateway: createAIGateway({
      providerAdapter: createStandardLocalProvider({
        planResolver: () => ({
          intent: "Valid context test",
          analysis: "Test",
          proposedCommands: ["node --version"],
          proposedFileChanges: [targetFile],
          proposedFileMutations: [{ file: targetFile, content: validContent, expectedState: null }],
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

    // 1. Workspace
    await makeRequest(server, { method: "POST", path: "/api/workspace" }, { rootPath: workspaceRoot });

    // 2. Plan
    const planRes = await makeRequest(server, { method: "POST", path: "/api/plan" }, { task: "Run test J" });
    assert.equal(planRes.status, 200);

    // 3. Valid Execution: Exactly 1 launch
    const execRes = await makeRequest(server, { method: "POST", path: "/api/execute" }, {
      command: "node --version",
      planId: planRes.data.authoritativePlanId,
      taskId: planRes.data.plan.taskId,
      approval: true
    });
    assert.equal(execRes.status, 200);
    assert.equal(execRes.data.status, "COMPLETED");
    assert.equal(launchCount, 1, "Exactly 1 process launch for valid authorized context");

    // 4. Valid Mutation: Exactly 1 write with matching authorized content
    const mutRes = await makeRequest(server, { method: "POST", path: "/api/mutate" }, {
      targetPath: targetFile,
      content: validContent,
      planId: planRes.data.authoritativePlanId,
      taskId: planRes.data.plan.taskId,
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
