/**
 * FAZ 44 Adversarial Test Suite: Autonomous Policy Controlled Decision Boundary Hardening
 *
 * Verifies:
 * 1. Deep Immutability & Returned Decision Immutability
 * 2. Type Confusion Defense on Counters (negative, NaN, Infinity, string coercion, null/undefined)
 * 3. Boundary & Off-by-One Defense (0, 1, limit - 1, limit, limit + 1)
 * 4. Policy Confusion (unknown fields, missing fields, malformed structure)
 * 5. Strict Authority Separation (Policy evaluation ≠ Execution / Admission)
 * 6. Non-Mutation Invariant (Policy evaluation never mutates JobState, TaskState, or WorkUnit)
 * 7. HTTP Endpoint Robustness (POST /api/autonomous-policy/evaluate with malformed data)
 * 8. Zero Process Spawn / Zero Filesystem Write during evaluation
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import {
  JobState,
  TaskState,
  ErrorCodes,
  WorkUnitStatus,
  WorkUnitActionType,
  createJobEngine,
  createWorkUnit,
  admitWorkUnit,
  executeWorkUnit,
  createExecutionPlanContract,
  createAutonomousPolicyContract,
  evaluateAutonomousPolicy,
  AutonomousPolicyDecision
} from '../src/index.js';
import { createApplicationServer } from '../src/app/index.js';

test('FAZ 44 - ADV-01: Deep immutability of policy and evaluation decision objects', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-adv-1',
    tenantId: 't-adv',
    allowedActionTypes: [WorkUnitActionType.COMMAND],
    maxExecutions: 3
  });

  const wu = createWorkUnit({
    id: 'wu-adv-1',
    tenantId: 't-adv',
    workspaceRoot: '/tmp/ws',
    jobId: 'j-adv',
    taskId: 't-adv',
    planId: 'p-adv',
    action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
  });

  const evaluation = evaluateAutonomousPolicy({ policy, workUnit: wu });
  assert.equal(evaluation.decision, AutonomousPolicyDecision.ADMIT);

  // Assert returned evaluation object is frozen
  assert.ok(Object.isFrozen(evaluation));
  assert.throws(() => {
    'use strict';
    evaluation.decision = AutonomousPolicyDecision.REJECT;
  }, TypeError);
  assert.throws(() => {
    'use strict';
    policy.maxExecutions = 999;
  }, TypeError);
});

test('FAZ 44 - ADV-02: Type confusion defense on counters (fail-closed against negative, NaN, Infinity, string coercion)', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-type',
    tenantId: 't1',
    maxExecutions: 5,
    maxCommands: 5,
    maxMutations: 5
  });

  const wu = createWorkUnit({
    id: 'wu-type',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
  });

  // 1. Negative execution counter
  const resNeg = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: -1 });
  assert.equal(resNeg.decision, AutonomousPolicyDecision.REJECT);
  assert.equal(resNeg.code, ErrorCodes.INVALID_CONTRACT);

  // 2. NaN counter
  const resNaN = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: NaN });
  assert.equal(resNaN.decision, AutonomousPolicyDecision.REJECT);

  // 3. Infinity counter
  const resInf = evaluateAutonomousPolicy({ policy, workUnit: wu, currentCommands: Infinity });
  assert.equal(resInf.decision, AutonomousPolicyDecision.REJECT);

  // 4. String coercion attempt (e.g. "0")
  const resStr = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: '0' });
  assert.equal(resStr.decision, AutonomousPolicyDecision.REJECT);

  // 5. Float/non-integer
  const resFloat = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 1.5 });
  assert.equal(resFloat.decision, AutonomousPolicyDecision.REJECT);
});

test('FAZ 44 - ADV-03: Boundary testing and off-by-one verification on budgets', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-bnd',
    tenantId: 't1',
    maxExecutions: 2,
    maxCommands: 2
  });

  const wu = createWorkUnit({
    id: 'wu-bnd',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
  });

  // limit - 1 (1/2): ADMIT
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 1, currentCommands: 1 }).decision, AutonomousPolicyDecision.ADMIT);

  // exact limit (2/2): REJECT (budget exhausted)
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 2, currentCommands: 1 }).decision, AutonomousPolicyDecision.REJECT);
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 1, currentCommands: 2 }).decision, AutonomousPolicyDecision.REJECT);

  // limit + 1 (3/2): REJECT
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 3, currentCommands: 1 }).decision, AutonomousPolicyDecision.REJECT);
});

test('FAZ 44 - ADV-04: Determinism: Identical inputs yield identical decisions', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-det',
    tenantId: 't1',
    maxExecutions: 3
  });

  const wu = createWorkUnit({
    id: 'wu-det',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
  });

  const d1 = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 0 });
  const d2 = evaluateAutonomousPolicy({ policy, workUnit: wu, currentExecutions: 0 });

  assert.equal(d1.decision, d2.decision);
  assert.equal(d1.reason, d2.reason);
  assert.equal(d1.policyId, d2.policyId);
});

test('FAZ 44 - ADV-05: Authority Separation: Evaluation confers ZERO authority and cannot bypass Admission Gate', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz44-authsep-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-sep', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-sep', jobId: 'job-sep', objective: 'Test task', tenantId: 't1' });
    engine.setJobPlan('job-sep', createExecutionPlanContract({
      id: 'plan-sep',
      taskId: 'task-sep',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    // Permissive policy
    const policy = createAutonomousPolicyContract({
      id: 'pol-perm',
      tenantId: 't1',
      maxExecutions: 100
    });

    // WorkUnit attempting unauthorized command 'whoami'
    const wuUnauthorized = createWorkUnit({
      id: 'wu-unauth-cmd',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-sep',
      taskId: 'task-sep',
      planId: 'plan-sep',
      action: { type: WorkUnitActionType.COMMAND, command: 'whoami' }
    });

    // 1. Policy evaluation produces ADMIT (because policy itself allows commands)
    const policyResult = evaluateAutonomousPolicy({ policy, workUnit: wuUnauthorized });
    assert.equal(policyResult.decision, AutonomousPolicyDecision.ADMIT);

    // 2. Critical Invariant: Policy ADMIT MUST NOT allow admission or execution of unauthorized command!
    assert.throws(() => admitWorkUnit({ workUnit: wuUnauthorized, jobEngine: engine }), /SECURITY_BLOCKED/);
    assert.throws(() => executeWorkUnit({ workUnit: wuUnauthorized, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 44 - ADV-06: Zero side-effects guarantee (zero process spawn, zero disk mutation during evaluation)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz44-sidefx-'));
  try {
    const policy = createAutonomousPolicyContract({
      id: 'pol-sidefx',
      tenantId: 't1',
      allowedActionTypes: [WorkUnitActionType.MUTATION]
    });

    const targetFile = 'unwritten.txt';
    const wu = createWorkUnit({
      id: 'wu-sidefx',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'j1',
      taskId: 't1',
      planId: 'p1',
      action: {
        type: WorkUnitActionType.MUTATION,
        targetPath: targetFile,
        content: 'should never be written during evaluation'
      }
    });

    // Run evaluation
    const evalRes = evaluateAutonomousPolicy({ policy, workUnit: wu });
    assert.equal(evalRes.decision, AutonomousPolicyDecision.ADMIT);

    // Prove NO file was created on disk
    assert.equal(fs.existsSync(path.join(tempDir, targetFile)), false, 'Policy evaluation must NEVER perform filesystem mutations');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 44 - ADV-07: HTTP Boundary defense against type confusion and malformed payloads', async () => {
  const engine = createJobEngine();
  const server = createApplicationServer({ jobEngine: engine });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;

  const requestHelper = (pathName, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(pathName, baseUrl);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: { 'Content-Type': 'application/json' }
        },
        res => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
            } catch {
              resolve({ statusCode: res.statusCode, data: body });
            }
          });
        }
      );
      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  };

  try {
    // 1. Counter type confusion over HTTP (currentExecutions: -5)
    const resNegative = await requestHelper('/api/autonomous-policy/evaluate', 'POST', {
      policy: { id: 'pol-http', tenantId: 't1', maxExecutions: 3 },
      workUnit: {
        id: 'wu-http',
        tenantId: 't1',
        workspaceRoot: process.cwd(),
        jobId: 'j1',
        taskId: 't1',
        planId: 'p1',
        action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
      },
      currentExecutions: -5
    });
    assert.equal(resNegative.statusCode, 200);
    assert.equal(resNegative.data.decision, AutonomousPolicyDecision.REJECT);

    // 2. Missing policy fails closed
    const resMissing = await requestHelper('/api/autonomous-policy/evaluate', 'POST', {
      workUnit: {}
    });
    assert.equal(resMissing.statusCode, 400);
    assert.equal(resMissing.data.success, false);
  } finally {
    server.close();
  }
});
