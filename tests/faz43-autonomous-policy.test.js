/**
 * FAZ 43 Test Suite: Controlled Autonomous Development - Policy & Execution Orchestration Readiness
 *
 * Verifies:
 * 1. Declarative Autonomous Policy Contract creation, immutability, and parameter bounds
 * 2. Deterministic policy evaluation rules (ADMIT vs REJECT)
 * 3. Budget enforcement (maxExecutions, maxCommands, maxMutations, undefined != unlimited)
 * 4. Policy cannot expand authority (Policy ADMIT alone confers zero execution authority)
 * 5. Full Authority Chain requirement: WorkUnit MUST pass Admission Gate after Policy ADMIT
 * 6. Negative security tests:
 *    - Tenant mismatch -> REJECT
 *    - Job mismatch -> REJECT
 *    - Task mismatch -> REJECT
 *    - Plan mismatch -> REJECT
 *    - Denied command pattern -> REJECT
 *    - Workspace escape mutation -> REJECT
 *    - Malformed or missing policy -> FAIL-CLOSED (REJECT)
 * 7. Zero JobState / TaskState mutation during policy evaluation
 * 8. Zero WorkUnit mutation during policy evaluation
 * 9. HTTP API boundary evaluation (/api/autonomous-policy/evaluate)
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
  ValidationResult,
  WorkUnitStatus,
  WorkUnitActionType,
  createJobEngine,
  createWorkUnit,
  admitWorkUnit,
  executeWorkUnit,
  createExecutionPlanContract,
  createAutonomousPolicyContract,
  evaluateAutonomousPolicy,
  AutonomousPolicyDecision,
  AutonomousMode
} from '../src/index.js';
import { createApplicationServer } from '../src/app/index.js';

test('FAZ 43 - TEST 1: Policy Contract creation, immutability, and default parameter validation', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-01',
    tenantId: 'tenant-alpha',
    jobId: 'job-01',
    maxExecutions: 5,
    maxCommands: 3,
    maxMutations: 2
  });

  assert.equal(policy.id, 'pol-01');
  assert.equal(policy.tenantId, 'tenant-alpha');
  assert.equal(policy.jobId, 'job-01');
  assert.equal(policy.maxExecutions, 5);
  assert.equal(policy.maxCommands, 3);
  assert.equal(policy.maxMutations, 2);
  assert.ok(Object.isFrozen(policy));

  // Immutability attack
  assert.throws(() => {
    'use strict';
    policy.maxExecutions = 999;
  }, TypeError);

  // Missing required fields
  assert.throws(() => createAutonomousPolicyContract({ id: 'bad' }), /INVALID_CONTRACT/);
  assert.throws(() => createAutonomousPolicyContract({ tenantId: 't1' }), /INVALID_CONTRACT/);

  // Negative / non-integer budget checks (undefined != unlimited)
  assert.throws(() => createAutonomousPolicyContract({ id: 'p', tenantId: 't', maxExecutions: -1 }), /INVALID_CONTRACT/);
  assert.throws(() => createAutonomousPolicyContract({ id: 'p', tenantId: 't', maxExecutions: 'unlimited' }), /INVALID_CONTRACT/);
});

test('FAZ 43 - TEST 2: Policy Evaluation PASS produces ADMIT decision when compliant', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-02',
    tenantId: 'tenant-1',
    jobId: 'job-1',
    taskId: 'task-1',
    planId: 'plan-1',
    maxExecutions: 2,
    maxCommands: 2
  });

  const wu = createWorkUnit({
    id: 'wu-02',
    tenantId: 'tenant-1',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-1',
    taskId: 'task-1',
    planId: 'plan-1',
    action: { type: WorkUnitActionType.COMMAND, command: 'npm test' }
  });

  const evaluation = evaluateAutonomousPolicy({
    policy,
    workUnit: wu,
    currentExecutions: 0,
    currentCommands: 0
  });

  assert.equal(evaluation.decision, AutonomousPolicyDecision.ADMIT);
  assert.equal(evaluation.policyId, 'pol-02');
  assert.equal(evaluation.workUnitId, 'wu-02');
  assert.ok(Object.isFrozen(evaluation));
});

test('FAZ 43 - TEST 3: Cross-tenant policy evaluation fails closed (REJECT)', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-tenant',
    tenantId: 'tenant-A',
    maxExecutions: 5
  });

  const wu = createWorkUnit({
    id: 'wu-tenant',
    tenantId: 'tenant-B', // Cross-tenant!
    workspaceRoot: '/tmp/ws',
    jobId: 'job-1',
    taskId: 'task-1',
    planId: 'plan-1',
    action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
  });

  const evaluation = evaluateAutonomousPolicy({ policy, workUnit: wu });
  assert.equal(evaluation.decision, AutonomousPolicyDecision.REJECT);
  assert.equal(evaluation.code, ErrorCodes.SECURITY_BLOCKED);
});

test('FAZ 43 - TEST 4: Scoped Job, Task, and Plan mismatches fail closed (REJECT)', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-scope',
    tenantId: 't1',
    jobId: 'job-A',
    taskId: 'task-A',
    planId: 'plan-A'
  });

  // 1. Job mismatch
  const wuBadJob = createWorkUnit({
    id: 'wu-bj',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-B',
    taskId: 'task-A',
    planId: 'plan-A',
    action: { type: WorkUnitActionType.COMMAND, command: 'echo ok' }
  });
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wuBadJob }).decision, AutonomousPolicyDecision.REJECT);

  // 2. Task mismatch
  const wuBadTask = createWorkUnit({
    id: 'wu-bt',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-A',
    taskId: 'task-B',
    planId: 'plan-A',
    action: { type: WorkUnitActionType.COMMAND, command: 'echo ok' }
  });
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wuBadTask }).decision, AutonomousPolicyDecision.REJECT);

  // 3. Plan mismatch
  const wuBadPlan = createWorkUnit({
    id: 'wu-bp',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-A',
    taskId: 'task-A',
    planId: 'plan-B',
    action: { type: WorkUnitActionType.COMMAND, command: 'echo ok' }
  });
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wuBadPlan }).decision, AutonomousPolicyDecision.REJECT);
});

test('FAZ 43 - TEST 5: Action type restrictions and command/mutation patterns', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-act',
    tenantId: 't1',
    allowedActionTypes: [WorkUnitActionType.COMMAND], // Mutations disallowed
    deniedCommandPatterns: ['rm -rf', 'format']
  });

  // Disallowed action type (MUTATION)
  const wuMut = createWorkUnit({
    id: 'wu-mut',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.MUTATION, targetPath: 'a.txt', content: 'test' }
  });
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wuMut }).decision, AutonomousPolicyDecision.REJECT);

  // Denied command pattern
  const wuDeniedCmd = createWorkUnit({
    id: 'wu-dcmd',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'rm -rf /' }
  });
  assert.equal(evaluateAutonomousPolicy({ policy, workUnit: wuDeniedCmd }).decision, AutonomousPolicyDecision.REJECT);
});

test('FAZ 43 - TEST 6: Budget exhaustion enforcement (maxExecutions, maxCommands, maxMutations)', () => {
  const policy = createAutonomousPolicyContract({
    id: 'pol-budget',
    tenantId: 't1',
    maxExecutions: 2,
    maxCommands: 1
  });

  const wu = createWorkUnit({
    id: 'wu-bgt',
    tenantId: 't1',
    workspaceRoot: '/tmp/ws',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'echo hi' }
  });

  // Current executions exhausted (2/2)
  const evalExec = evaluateAutonomousPolicy({
    policy,
    workUnit: wu,
    currentExecutions: 2,
    currentCommands: 0
  });
  assert.equal(evalExec.decision, AutonomousPolicyDecision.REJECT);
  assert.ok(evalExec.reason.includes('Execution budget exhausted'));

  // Current commands exhausted (1/1)
  const evalCmd = evaluateAutonomousPolicy({
    policy,
    workUnit: wu,
    currentExecutions: 0,
    currentCommands: 1
  });
  assert.equal(evalCmd.decision, AutonomousPolicyDecision.REJECT);
  assert.ok(evalCmd.reason.includes('Command budget exhausted'));
});

test('FAZ 43 - TEST 7: Mutation target boundary escape detection in policy evaluator', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz43-ws-'));
  try {
    const policy = createAutonomousPolicyContract({
      id: 'pol-mut',
      tenantId: 't1',
      allowedActionTypes: [WorkUnitActionType.MUTATION]
    });

    // Target escapes workspace
    const wuEscape = createWorkUnit({
      id: 'wu-esc',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'j1',
      taskId: 't1',
      planId: 'p1',
      action: { type: WorkUnitActionType.MUTATION, targetPath: '../outside.txt', content: 'hack' }
    });

    const res = evaluateAutonomousPolicy({ policy, workUnit: wuEscape });
    assert.equal(res.decision, AutonomousPolicyDecision.REJECT);
    assert.ok(res.reason.includes('escapes workspace'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 43 - TEST 8: Policy ADMIT alone confers ZERO execution authority (Must pass Admission Gate)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz43-admgate-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-g', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-g', jobId: 'job-g', objective: 'Gated task', tenantId: 't1' });
    engine.setJobPlan('job-g', createExecutionPlanContract({
      id: 'plan-g',
      taskId: 'task-g',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v'] // Only 'node -v' authorized in plan!
    }), { tenantId: 't1' });

    // Permissive policy that would ADMIT any command
    const permissivePolicy = createAutonomousPolicyContract({
      id: 'pol-perm',
      tenantId: 't1',
      maxExecutions: 10,
      maxCommands: 10
    });

    // WorkUnit attempting unauthorized command 'unauthorized-cmd'
    const unauthWu = createWorkUnit({
      id: 'wu-unauth',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-g',
      taskId: 'task-g',
      planId: 'plan-g',
      action: { type: WorkUnitActionType.COMMAND, command: 'unauthorized-cmd' }
    });

    // 1. Policy evaluator says ADMIT (because policy allows general commands)
    const policyDecision = evaluateAutonomousPolicy({ policy: permissivePolicy, workUnit: unauthWu });
    assert.equal(policyDecision.decision, AutonomousPolicyDecision.ADMIT);

    // 2. BUT Admission Gate MUST reject because authoritative Plan did NOT authorize 'unauthorized-cmd'
    assert.throws(() => {
      admitWorkUnit({ workUnit: unauthWu, jobEngine: engine });
    }, /SECURITY_BLOCKED/);

    // 3. Execution MUST be blocked fail-closed
    assert.throws(() => {
      executeWorkUnit({ workUnit: unauthWu, jobEngine: engine });
    }, /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 43 - TEST 9: Invariant preservation: Zero JobState or TaskState or WorkUnit mutation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz43-invar-'));
  try {
    const engine = createJobEngine();
    const job = engine.createJob({
      id: 'job-inv',
      projectId: 'p1',
      workflowId: 'w1',
      tenantId: 't1',
      status: JobState.RUNNING,
      workspaceReference: tempDir
    });
    const task = engine.createTask({
      id: 'task-inv',
      jobId: 'job-inv',
      objective: 'Task Inv',
      status: TaskState.READY,
      tenantId: 't1'
    });

    const policy = createAutonomousPolicyContract({
      id: 'pol-inv',
      tenantId: 't1',
      jobId: 'job-inv'
    });

    const wu = createWorkUnit({
      id: 'wu-inv',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-inv',
      taskId: 'task-inv',
      planId: 'plan-inv',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    evaluateAutonomousPolicy({ policy, workUnit: wu });

    // JobState remains RUNNING
    assert.equal(engine.getJob('job-inv', { tenantId: 't1' }).status, JobState.RUNNING);
    // TaskState remains READY
    assert.equal(engine.getTask('task-inv', { tenantId: 't1' }).status, TaskState.READY);
    // WorkUnit status remains PENDING
    assert.equal(wu.status, WorkUnitStatus.PENDING);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 43 - TEST 10: Missing, null, or malformed policy fails closed (REJECT)', () => {
  const wu = createWorkUnit({
    id: 'wu-mal',
    tenantId: 't1',
    workspaceRoot: '/tmp',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: WorkUnitActionType.COMMAND, command: 'ls' }
  });

  assert.equal(evaluateAutonomousPolicy({ policy: null, workUnit: wu }).decision, AutonomousPolicyDecision.REJECT);
  assert.equal(evaluateAutonomousPolicy({ policy: undefined, workUnit: wu }).decision, AutonomousPolicyDecision.REJECT);
  assert.equal(evaluateAutonomousPolicy({ policy: {}, workUnit: wu }).decision, AutonomousPolicyDecision.REJECT);
  assert.equal(evaluateAutonomousPolicy({ policy: 'string', workUnit: wu }).decision, AutonomousPolicyDecision.REJECT);
});

test('FAZ 43 - TEST 11: HTTP Server Autonomous Policy Evaluation Endpoint', async () => {
  const engine = createJobEngine();
  const server = createApplicationServer({ jobEngine: engine });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;

  const requestHelper = (pathName, method = 'GET', data = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(pathName, baseUrl);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: { 'Content-Type': 'application/json', ...headers }
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
    const res = await requestHelper('/api/autonomous-policy/evaluate', 'POST', {
      policy: {
        id: 'pol-http',
        tenantId: 'tenant-http',
        maxExecutions: 3
      },
      workUnit: {
        id: 'wu-http',
        tenantId: 'tenant-http',
        workspaceRoot: process.cwd(),
        jobId: 'job-http',
        taskId: 'task-http',
        planId: 'plan-http',
        action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.decision, AutonomousPolicyDecision.ADMIT);
  } finally {
    server.close();
  }
});
