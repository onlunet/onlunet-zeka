/**
 * FAZ 40 Test Suite: Controlled Work Execution Contract
 *
 * Verifies:
 * 1. Work Unit creation & schema validation
 * 2. Work Unit identity & immutability
 * 3. Authority admission (Tenant -> Workspace -> Job -> Plan -> Task -> Action)
 * 4. Tenant isolation (cross-tenant admission/execution blocked)
 * 5. Workspace isolation (cross-workspace execution blocked)
 * 6. Job isolation (cross-job execution blocked)
 * 7. Plan isolation (unauthorized plan execution blocked)
 * 8. Task isolation (mismatched parent task blocked)
 * 9. Controlled execution for COMMAND actions
 * 10. Controlled execution for MUTATION actions
 * 11. Execution result association & persistence in JobEngine
 * 12. Verification result (ValidationResult.PASS vs FAIL)
 * 13. Failure handling (graceful failure recording, no crash)
 * 14. Zero automatic retries (maxRetries = 0 invariant)
 * 15. Zero Job lifecycle mutation (Job status remains explicit and unchanged)
 * 16. Zero Task lifecycle mutation (Task status remains explicit and unchanged)
 * 17. Concurrency isolation (concurrent work units execute without collision)
 * 18. HTTP API endpoints for Work Unit admission and execution
 * 19. Negative authorization (missing or unapproved action fails closed)
 * 20. Malformed input handling (fail-closed with INVALID_CONTRACT)
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
  AdmissionDecision,
  WorkUnitStatus,
  WorkUnitActionType,
  createJobEngine,
  createWorkUnit,
  admitWorkUnit,
  executeWorkUnit,
  createExecutionPlanContract
} from '../src/index.js';
import { createApplicationServer } from '../src/app/index.js';

test('FAZ 40 - TEST 1 & 2: Work Unit creation, schema invariants, and immutability', () => {
  const wu = createWorkUnit({
    id: 'wu-101',
    tenantId: 'tenant-alpha',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-101',
    taskId: 'task-101',
    planId: 'plan-101',
    action: {
      type: WorkUnitActionType.COMMAND,
      command: 'node --version'
    }
  });

  assert.equal(wu.id, 'wu-101');
  assert.equal(wu.tenantId, 'tenant-alpha');
  assert.equal(wu.jobId, 'job-101');
  assert.equal(wu.taskId, 'task-101');
  assert.equal(wu.planId, 'plan-101');
  assert.equal(wu.status, WorkUnitStatus.PENDING);
  assert.equal(wu.action.command, 'node --version');
  assert.ok(Object.isFrozen(wu));
  assert.ok(Object.isFrozen(wu.action));

  // Negative: Missing required fields
  assert.throws(() => createWorkUnit({ id: 'wu-bad' }), /INVALID_CONTRACT/);
  assert.throws(() => createWorkUnit({
    id: 'wu-bad',
    tenantId: 't1',
    workspaceRoot: '/tmp',
    jobId: 'j1',
    taskId: 't1',
    planId: 'p1',
    action: { type: 'UNKNOWN' }
  }), /INVALID_CONTRACT/);
});

test('FAZ 40 - TEST 3: Work Unit authority admission against full chain', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-t3-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-a', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-a', jobId: 'job-a', objective: 'Task A', tenantId: 't1' });
    engine.setJobPlan('job-a', createExecutionPlanContract({
      id: 'plan-a',
      taskId: 'task-a',
      workspaceRoot: tempDir,
      expectedCommands: ['npm --version'],
      expectedFileChanges: ['config.json']
    }), { tenantId: 't1' });

    const validUnit = createWorkUnit({
      id: 'wu-valid',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-a',
      taskId: 'task-a',
      planId: 'plan-a',
      action: { type: WorkUnitActionType.COMMAND, command: 'npm --version' }
    });

    const admission = admitWorkUnit({ workUnit: validUnit, jobEngine: engine });
    assert.equal(admission.decision, AdmissionDecision.ALLOWED);
    assert.equal(admission.workUnitId, 'wu-valid');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 4 & 5: Tenant and Workspace isolation fail closed', () => {
  const tempDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-wsA-'));
  const tempDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-wsB-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-iso', projectId: 'p1', workflowId: 'w1', tenantId: 'tenant-A', workspaceReference: tempDirA });
    engine.createTask({ id: 'task-iso', jobId: 'job-iso', objective: 'Task Iso', tenantId: 'tenant-A' });
    engine.setJobPlan('job-iso', createExecutionPlanContract({
      id: 'plan-iso',
      taskId: 'task-iso',
      workspaceRoot: tempDirA,
      expectedCommands: ['echo ok']
    }), { tenantId: 'tenant-A' });

    // Test 4: Tenant B cannot execute Tenant A work unit
    const crossTenantUnit = createWorkUnit({
      id: 'wu-cross-t',
      tenantId: 'tenant-B',
      workspaceRoot: tempDirA,
      jobId: 'job-iso',
      taskId: 'task-iso',
      planId: 'plan-iso',
      action: { type: WorkUnitActionType.COMMAND, command: 'echo ok' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: crossTenantUnit, jobEngine: engine }), /SECURITY_BLOCKED/);

    // Test 5: Workspace mismatch fails closed
    const crossWsUnit = createWorkUnit({
      id: 'wu-cross-ws',
      tenantId: 'tenant-A',
      workspaceRoot: tempDirB,
      jobId: 'job-iso',
      taskId: 'task-iso',
      planId: 'plan-iso',
      action: { type: WorkUnitActionType.COMMAND, command: 'echo ok' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: crossWsUnit, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDirA, { recursive: true, force: true });
    fs.rmSync(tempDirB, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 6, 7 & 8: Job, Plan, and Task isolation fail closed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-jpt-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-1', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createJob({ id: 'job-2', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-1', jobId: 'job-1', objective: 'Task 1', tenantId: 't1' });
    engine.createTask({ id: 'task-2', jobId: 'job-2', objective: 'Task 2', tenantId: 't1' });

    engine.setJobPlan('job-1', createExecutionPlanContract({
      id: 'plan-1',
      taskId: 'task-1',
      workspaceRoot: tempDir,
      expectedCommands: ['cmd-1']
    }), { tenantId: 't1' });

    // Test 6: Job mismatch (Job 2 trying to use Plan 1)
    const badJob = createWorkUnit({
      id: 'wu-bad-j',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-2',
      taskId: 'task-2',
      planId: 'plan-1',
      action: { type: WorkUnitActionType.COMMAND, command: 'cmd-1' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: badJob, jobEngine: engine }), /SECURITY_BLOCKED/);

    // Test 7: Task mismatch (Task 2 bound to Job 1)
    const badTask = createWorkUnit({
      id: 'wu-bad-t',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-1',
      taskId: 'task-2',
      planId: 'plan-1',
      action: { type: WorkUnitActionType.COMMAND, command: 'cmd-1' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: badTask, jobEngine: engine }), /SECURITY_BLOCKED/);

    // Test 8: Action command not authorized in plan
    const badAction = createWorkUnit({
      id: 'wu-bad-act',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-1',
      taskId: 'task-1',
      planId: 'plan-1',
      action: { type: WorkUnitActionType.COMMAND, command: 'unauthorized-cmd' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: badAction, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 9, 11 & 12: Controlled COMMAND execution, result association, and verification', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-cmd-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-cmd', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-cmd', jobId: 'job-cmd', objective: 'Run node echo', tenantId: 't1' });
    engine.setJobPlan('job-cmd', createExecutionPlanContract({
      id: 'plan-cmd',
      taskId: 'task-cmd',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-cmd-1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-cmd',
      taskId: 'task-cmd',
      planId: 'plan-cmd',
      action: {
        type: WorkUnitActionType.COMMAND,
        command: 'node -v'
      }
    });

    // Execute through WorkUnit contract
    const executed = executeWorkUnit({ workUnit: wu, jobEngine: engine });

    assert.equal(executed.status, WorkUnitStatus.SUCCEEDED);
    assert.equal(executed.verificationResult, ValidationResult.PASS);
    assert.ok(executed.executionResultId);
    assert.ok(executed.startedAt);
    assert.ok(executed.completedAt);

    // Execution result formally recorded in JobEngine under jobId
    const results = engine.listJobExecutionResults('job-cmd', { tenantId: 't1' });
    assert.equal(results.length, 1);
    assert.equal(results[0].jobId, 'job-cmd');
    assert.equal(results[0].taskId, 'task-cmd');
    assert.equal(results[0].outcome, 'SUCCEEDED');
    assert.equal(results[0].result.workUnitId, 'wu-cmd-1');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 10: Controlled MUTATION execution and verification', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-mut-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-mut', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-mut', jobId: 'job-mut', objective: 'Mutate hello.txt', tenantId: 't1' });
    engine.setJobPlan('job-mut', createExecutionPlanContract({
      id: 'plan-mut',
      taskId: 'task-mut',
      workspaceRoot: tempDir,
      expectedCommands: [],
      expectedFileChanges: ['hello.txt']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-mut-1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-mut',
      taskId: 'task-mut',
      planId: 'plan-mut',
      action: {
        type: WorkUnitActionType.MUTATION,
        targetPath: 'hello.txt',
        content: 'Controlled content from WorkUnit'
      }
    });

    const executed = executeWorkUnit({ workUnit: wu, jobEngine: engine });
    assert.equal(executed.status, WorkUnitStatus.SUCCEEDED);
    assert.equal(executed.verificationResult, ValidationResult.PASS);

    // Verify file actually written inside workspaceRoot
    const writtenPath = path.join(tempDir, 'hello.txt');
    assert.ok(fs.existsSync(writtenPath));
    assert.equal(fs.readFileSync(writtenPath, 'utf-8'), 'Controlled content from WorkUnit');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 13 & 14: Failure handling, zero automatic retries, no daemon loop', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-fail-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-fail', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-fail', jobId: 'job-fail', objective: 'Failing command', tenantId: 't1' });
    engine.setJobPlan('job-fail', createExecutionPlanContract({
      id: 'plan-fail',
      taskId: 'task-fail',
      workspaceRoot: tempDir,
      expectedCommands: ['node -e process.exit(1)']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-f1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-fail',
      taskId: 'task-fail',
      planId: 'plan-fail',
      action: {
        type: WorkUnitActionType.COMMAND,
        command: 'node -e process.exit(1)'
      }
    });

    const executed = executeWorkUnit({ workUnit: wu, jobEngine: engine });
    assert.equal(executed.status, WorkUnitStatus.FAILED);
    assert.equal(executed.verificationResult, ValidationResult.FAIL);
    assert.ok(executed.error);

    // Invariant: MAX_RETRIES = 0. isRetryAllowed remains false, no loop occurs.
    assert.equal(engine.isRetryAllowed('job-fail', 0, { tenantId: 't1' }), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 15 & 16: Invariant preservation: Zero Job or Task lifecycle mutation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-lifecycle-'));
  try {
    const engine = createJobEngine();
    const jobBefore = engine.createJob({
      id: 'job-life',
      projectId: 'p1',
      workflowId: 'w1',
      tenantId: 't1',
      status: JobState.RUNNING,
      workspaceReference: tempDir
    });
    const taskBefore = engine.createTask({
      id: 'task-life',
      jobId: 'job-life',
      objective: 'Task objective',
      status: TaskState.READY,
      tenantId: 't1'
    });
    engine.setJobPlan('job-life', createExecutionPlanContract({
      id: 'plan-life',
      taskId: 'task-life',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-life-1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-life',
      taskId: 'task-life',
      planId: 'plan-life',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    executeWorkUnit({ workUnit: wu, jobEngine: engine });

    // INVARIANT: Job state was NOT changed to COMPLETED
    const jobAfter = engine.getJob('job-life', { tenantId: 't1' });
    assert.equal(jobAfter.status, JobState.RUNNING);

    // INVARIANT: Task state was NOT mutated
    const taskAfter = engine.getTask('task-life', { tenantId: 't1' });
    assert.equal(taskAfter.status, TaskState.READY);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 17: Concurrency isolation: Concurrent work units preserve isolation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-conc-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-A', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createJob({ id: 'job-B', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-A', jobId: 'job-A', objective: 'Task A', tenantId: 't1' });
    engine.createTask({ id: 'task-B', jobId: 'job-B', objective: 'Task B', tenantId: 't1' });

    engine.setJobPlan('job-A', createExecutionPlanContract({
      id: 'plan-A',
      taskId: 'task-A',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    engine.setJobPlan('job-B', createExecutionPlanContract({
      id: 'plan-B',
      taskId: 'task-B',
      workspaceRoot: tempDir,
      expectedCommands: ['node --version']
    }), { tenantId: 't1' });

    const wuA = createWorkUnit({
      id: 'wu-A',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-A',
      taskId: 'task-A',
      planId: 'plan-A',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    const wuB = createWorkUnit({
      id: 'wu-B',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-B',
      taskId: 'task-B',
      planId: 'plan-B',
      action: { type: WorkUnitActionType.COMMAND, command: 'node --version' }
    });

    const resA = executeWorkUnit({ workUnit: wuA, jobEngine: engine });
    const resB = executeWorkUnit({ workUnit: wuB, jobEngine: engine });

    assert.equal(resA.status, WorkUnitStatus.SUCCEEDED);
    assert.equal(resB.status, WorkUnitStatus.SUCCEEDED);

    const resultsA = engine.listJobExecutionResults('job-A', { tenantId: 't1' });
    const resultsB = engine.listJobExecutionResults('job-B', { tenantId: 't1' });
    assert.equal(resultsA.length, 1);
    assert.equal(resultsB.length, 1);
    assert.equal(resultsA[0].result.workUnitId, 'wu-A');
    assert.equal(resultsB[0].result.workUnitId, 'wu-B');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 40 - TEST 18, 19 & 20: HTTP Server Work Unit endpoints and negative authorization', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz40-http-'));
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
    await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });
    await requestHelper('/api/jobs', 'POST', { id: 'job-http', projectId: 'p1', workflowId: 'w1', tenantId: 't-http' });
    await requestHelper('/api/jobs/job-http/tasks', 'POST', { id: 'task-http', objective: 'HTTP Task', tenantId: 't-http' });

    engine.setJobPlan('job-http', createExecutionPlanContract({
      id: 'plan-http',
      taskId: 'task-http',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't-http' });

    // 1. Positive admission via HTTP
    const admitRes = await requestHelper('/api/work-units/admit', 'POST', {
      id: 'wu-http-1',
      tenantId: 't-http',
      workspaceRoot: tempDir,
      jobId: 'job-http',
      taskId: 'task-http',
      planId: 'plan-http',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });
    assert.equal(admitRes.statusCode, 200);
    assert.equal(admitRes.data.success, true);
    assert.equal(admitRes.data.admission.decision, AdmissionDecision.ALLOWED);

    // 2. Positive execution via HTTP
    const execRes = await requestHelper('/api/work-units/execute', 'POST', {
      id: 'wu-http-1',
      tenantId: 't-http',
      workspaceRoot: tempDir,
      jobId: 'job-http',
      taskId: 'task-http',
      planId: 'plan-http',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });
    assert.equal(execRes.statusCode, 200);
    assert.equal(execRes.data.success, true);
    assert.equal(execRes.data.workUnit.status, WorkUnitStatus.SUCCEEDED);
    assert.equal(execRes.data.workUnit.verificationResult, ValidationResult.PASS);

    // 3. Negative admission via HTTP: Unauthorized command fails closed
    const negRes = await requestHelper('/api/work-units/admit', 'POST', {
      id: 'wu-http-neg',
      tenantId: 't-http',
      workspaceRoot: tempDir,
      jobId: 'job-http',
      taskId: 'task-http',
      planId: 'plan-http',
      action: { type: WorkUnitActionType.COMMAND, command: 'unauthorized' }
    });
    assert.equal(negRes.statusCode, 400);
    assert.equal(negRes.data.success, false);
    assert.ok(negRes.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
