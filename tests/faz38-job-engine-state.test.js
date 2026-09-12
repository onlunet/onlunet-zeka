/**
 * FAZ 38 Test Suite: Task-Scoped Execution State & Authoritative Job Engine
 *
 * Verifies:
 * 1. Job Entity & Lifecycle State Transitions (Pending -> Planning -> Planned -> Admitted -> Executing -> Validating -> Completed / Failed / Blocked / Cancelled)
 * 2. Task Entity & Task State Transitions within Job context
 * 3. Deterministic rejection of illegal transitions (fail-closed)
 * 4. Multi-Job Isolation (State of Job A cannot leak into or affect Job B)
 * 5. Tenant Isolation (Tenant X cannot access or mutate Tenant Y jobs/tasks)
 * 6. Deterministic Persistence & Process Restart Reload (Atomic JSON state reload)
 * 7. Server API Endpoints for Jobs, Tasks, and task-scoped state management
 * 8. Zero Autonomous Loops / Zero AI Authority / Autonomy != Authority Invariants
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
  createJobEngine,
  createJob,
  createTask
} from '../src/index.js';
import { createApplicationServer } from '../src/app/index.js';

test('FAZ 38 - TEST 1: Create Job with valid fields and immutability', () => {
  const engine = createJobEngine();
  const job = engine.createJob({
    id: 'job-101',
    projectId: 'proj-alpha',
    workflowId: 'wf-alpha',
    tenantId: 'tenant-1',
    workspaceReference: '/workspaces/proj-alpha'
  });

  assert.equal(job.id, 'job-101');
  assert.equal(job.projectId, 'proj-alpha');
  assert.equal(job.workflowId, 'wf-alpha');
  assert.equal(job.tenantId, 'tenant-1');
  assert.equal(job.status, JobState.PENDING);
  assert.equal(job.workspaceReference, '/workspaces/proj-alpha');
  assert.deepEqual(job.taskIds, []);
  assert.ok(Object.isFrozen(job));

  const retrieved = engine.getJob('job-101', { tenantId: 'tenant-1' });
  assert.equal(retrieved.id, 'job-101');
});

test('FAZ 38 - TEST 2: Job Legal State Transitions succeed in sequence', () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-trans', projectId: 'p1', workflowId: 'w1' });

  // PENDING -> READY
  let updated = engine.updateJobState('job-trans', JobState.READY, { reason: 'Job is ready' });
  assert.equal(updated.status, JobState.READY);

  // READY -> RUNNING
  updated = engine.updateJobState('job-trans', JobState.RUNNING, { reason: 'Execution begun' });
  assert.equal(updated.status, JobState.RUNNING);

  // RUNNING -> VALIDATING
  updated = engine.updateJobState('job-trans', JobState.VALIDATING, { reason: 'Running validation' });
  assert.equal(updated.status, JobState.VALIDATING);

  // VALIDATING -> COMPLETED
  updated = engine.updateJobState('job-trans', JobState.COMPLETED, { reason: 'All checks passed' });
  assert.equal(updated.status, JobState.COMPLETED);
});

test('FAZ 38 - TEST 3: Job Illegal State Transitions fail closed', () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-illegal', projectId: 'p1', workflowId: 'w1' });

  // Illegal: PENDING directly to COMPLETED
  assert.throws(
    () => engine.updateJobState('job-illegal', JobState.COMPLETED),
    err => err.message.includes(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  // Illegal: PENDING directly to RUNNING
  assert.throws(
    () => engine.updateJobState('job-illegal', JobState.RUNNING),
    err => err.message.includes(ErrorCodes.INVALID_STATE_TRANSITION)
  );

  // Advance to terminal COMPLETED
  engine.updateJobState('job-illegal', JobState.READY);
  engine.updateJobState('job-illegal', JobState.RUNNING);
  engine.updateJobState('job-illegal', JobState.VALIDATING);
  engine.updateJobState('job-illegal', JobState.COMPLETED);

  // Illegal: COMPLETED to RUNNING (terminal state mutation)
  assert.throws(
    () => engine.updateJobState('job-illegal', JobState.RUNNING),
    err => err.message.includes(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

test('FAZ 38 - TEST 4: Create Task strictly bound to existing Job', () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-parent', projectId: 'p1', workflowId: 'w1', tenantId: 't1' });

  const task = engine.createTask({
    id: 'task-child-1',
    jobId: 'job-parent',
    objective: 'Implement feature X',
    taskType: 'CODE_MUTATION',
    tenantId: 't1'
  });

  assert.equal(task.id, 'task-child-1');
  assert.equal(task.jobId, 'job-parent');
  assert.equal(task.status, TaskState.PENDING);
  assert.equal(task.taskType, 'CODE_MUTATION');
  assert.ok(Object.isFrozen(task));

  // Verify parent job tracks task ID
  const parentJob = engine.getJob('job-parent', { tenantId: 't1' });
  assert.ok(parentJob.taskIds.includes('task-child-1'));

  // Verify listing
  const tasks = engine.listJobTasks('job-parent', { tenantId: 't1' });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'task-child-1');
});

test('FAZ 38 - TEST 5: Orphan Task creation fails closed', () => {
  const engine = createJobEngine();

  // Non-existent job throws INVALID_CONTRACT
  assert.throws(
    () => engine.createTask({
      id: 'task-orphan',
      jobId: 'non-existent-job',
      objective: 'No parent'
    }),
    err => err.message.includes(ErrorCodes.INVALID_CONTRACT)
  );
});

test('FAZ 38 - TEST 6: Task Legal and Illegal State Transitions', () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-t', projectId: 'p1', workflowId: 'w1' });
  engine.createTask({ id: 'task-t', jobId: 'job-t', objective: 'Step 1' });

  // PENDING -> READY
  let task = engine.updateTaskState('task-t', TaskState.READY);
  assert.equal(task.status, TaskState.READY);

  // READY -> RUNNING
  task = engine.updateTaskState('task-t', TaskState.RUNNING);
  assert.equal(task.status, TaskState.RUNNING);

  // RUNNING -> VALIDATING
  task = engine.updateTaskState('task-t', TaskState.VALIDATING);
  assert.equal(task.status, TaskState.VALIDATING);

  // VALIDATING -> COMPLETED
  task = engine.updateTaskState('task-t', TaskState.COMPLETED);
  assert.equal(task.status, TaskState.COMPLETED);

  // Illegal: COMPLETED to READY
  assert.throws(
    () => engine.updateTaskState('task-t', TaskState.READY),
    err => err.message.includes(ErrorCodes.INVALID_STATE_TRANSITION)
  );
});

test('FAZ 38 - TEST 7: Multi-Job Isolation prevents state leakage across jobs', () => {
  const engine = createJobEngine();

  // Create Job A and Job B
  engine.createJob({ id: 'job-A', projectId: 'proj-A', workflowId: 'wf-A' });
  engine.createJob({ id: 'job-B', projectId: 'proj-B', workflowId: 'wf-B' });

  engine.createTask({ id: 'task-A1', jobId: 'job-A', objective: 'Task in A' });
  engine.createTask({ id: 'task-B1', jobId: 'job-B', objective: 'Task in B' });

  // Update Job A to RUNNING
  engine.updateJobState('job-A', JobState.READY);
  engine.updateJobState('job-A', JobState.RUNNING);

  // Job B must remain PENDING
  const jobB = engine.getJob('job-B');
  assert.equal(jobB.status, JobState.PENDING);

  // Tasks in Job A must not be visible in Job B
  const tasksInB = engine.listJobTasks('job-B');
  assert.equal(tasksInB.length, 1);
  assert.equal(tasksInB[0].id, 'task-B1');
  assert.ok(!tasksInB.some(t => t.id === 'task-A1'));
});

test('FAZ 38 - TEST 8: Tenant Isolation blocks cross-tenant access and mutation', () => {
  const engine = createJobEngine();

  engine.createJob({
    id: 'job-tenant-alpha',
    projectId: 'p-alpha',
    workflowId: 'w-alpha',
    tenantId: 'TENANT_ALPHA'
  });

  engine.createTask({
    id: 'task-tenant-alpha',
    jobId: 'job-tenant-alpha',
    objective: 'Private task',
    tenantId: 'TENANT_ALPHA'
  });

  // Cross-tenant access: TENANT_BETA accessing TENANT_ALPHA job
  assert.throws(
    () => engine.getJob('job-tenant-alpha', { tenantId: 'TENANT_BETA' }),
    err => err.message.includes(ErrorCodes.SECURITY_BLOCKED)
  );

  // Cross-tenant mutation: TENANT_BETA mutating TENANT_ALPHA job
  assert.throws(
    () => engine.updateJobState('job-tenant-alpha', JobState.READY, { tenantId: 'TENANT_BETA' }),
    err => err.message.includes(ErrorCodes.SECURITY_BLOCKED)
  );

  // Cross-tenant task creation: TENANT_BETA trying to create task in TENANT_ALPHA job
  assert.throws(
    () => engine.createTask({
      id: 'task-infiltrator',
      jobId: 'job-tenant-alpha',
      objective: 'Unauthorized task',
      tenantId: 'TENANT_BETA'
    }),
    err => err.message.includes(ErrorCodes.SECURITY_BLOCKED)
  );

  // Cross-tenant task access
  assert.throws(
    () => engine.getTask('task-tenant-alpha', { tenantId: 'TENANT_BETA' }),
    err => err.message.includes(ErrorCodes.SECURITY_BLOCKED)
  );
});

test('FAZ 38 - TEST 9: Deterministic Persistence survives process restart', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-persistence-test-'));

  try {
    // Phase A: Engine 1 creates state and updates it
    const engine1 = createJobEngine({ storageDir: tempDir });
    engine1.createJob({
      id: 'job-persisted',
      projectId: 'proj-persist',
      workflowId: 'wf-persist',
      tenantId: 'tenant-p',
      workspaceReference: '/app/persist'
    });

    engine1.updateJobState('job-persisted', JobState.READY, { reason: 'Job is ready' });

    engine1.createTask({
      id: 'task-persisted-1',
      jobId: 'job-persisted',
      objective: 'Persisted task test',
      tenantId: 'tenant-p'
    });
    engine1.updateTaskState('task-persisted-1', TaskState.READY, { tenantId: 'tenant-p' });

    // Verify files physically exist on disk
    const jobFile = path.join(tempDir, 'jobs', 'job-persisted.json');
    const taskFile = path.join(tempDir, 'tasks', 'task-persisted-1.json');
    assert.ok(fs.existsSync(jobFile));
    assert.ok(fs.existsSync(taskFile));

    // Phase B: Simulate process crash/restart by instantiating new engine pointing to same storageDir
    const engine2 = createJobEngine({ storageDir: tempDir });

    const restoredJob = engine2.getJob('job-persisted', { tenantId: 'tenant-p' });
    assert.ok(restoredJob);
    assert.equal(restoredJob.id, 'job-persisted');
    assert.equal(restoredJob.status, JobState.READY);
    assert.equal(restoredJob.tenantId, 'tenant-p');
    assert.equal(restoredJob.workspaceReference, '/app/persist');
    assert.ok(restoredJob.taskIds.includes('task-persisted-1'));

    const restoredTask = engine2.getTask('task-persisted-1', { tenantId: 'tenant-p' });
    assert.ok(restoredTask);
    assert.equal(restoredTask.id, 'task-persisted-1');
    assert.equal(restoredTask.status, TaskState.READY);

    // Continue state progression on restored engine
    const nextJobState = engine2.updateJobState('job-persisted', JobState.RUNNING, { tenantId: 'tenant-p' });
    assert.equal(nextJobState.status, JobState.RUNNING);

    // Verify updated state written to disk
    const updatedDiskContent = JSON.parse(fs.readFileSync(jobFile, 'utf-8'));
    assert.equal(updatedDiskContent.status, JobState.RUNNING);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 38 - TEST 10: Server REST Endpoints manage Jobs and Tasks deterministically', async () => {
  const engine = createJobEngine();
  const server = createApplicationServer({ jobEngine: engine });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const requestHelper = (pathName, method = 'GET', data = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(pathName, baseUrl);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        },
        res => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
            } catch (e) {
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
    // 1. POST /api/jobs
    const createJobRes = await requestHelper('/api/jobs', 'POST', {
      id: 'job-api-1',
      projectId: 'proj-api',
      workflowId: 'wf-api',
      tenantId: 'tenant-api'
    });
    assert.equal(createJobRes.statusCode, 201);
    assert.equal(createJobRes.data.job.id, 'job-api-1');
    assert.equal(createJobRes.data.job.status, JobState.PENDING);

    // 2. GET /api/jobs/:id
    const getJobRes = await requestHelper('/api/jobs/job-api-1', 'GET', null, { 'x-tenant-id': 'tenant-api' });
    assert.equal(getJobRes.statusCode, 200);
    assert.equal(getJobRes.data.job.id, 'job-api-1');

    // 3. POST /api/jobs/:id/state
    const updateJobRes = await requestHelper('/api/jobs/job-api-1/state', 'POST', {
      status: JobState.READY,
      reason: 'HTTP initiated ready state',
      tenantId: 'tenant-api'
    });
    assert.equal(updateJobRes.statusCode, 200);
    assert.equal(updateJobRes.data.job.status, JobState.READY);

    // 4. POST /api/jobs/:id/tasks
    const createTaskRes = await requestHelper('/api/jobs/job-api-1/tasks', 'POST', {
      id: 'task-api-1',
      objective: 'API created task',
      tenantId: 'tenant-api'
    });
    assert.equal(createTaskRes.statusCode, 201);
    assert.equal(createTaskRes.data.task.id, 'task-api-1');
    assert.equal(createTaskRes.data.task.jobId, 'job-api-1');

    // 5. GET /api/jobs/:id/tasks
    const listTasksRes = await requestHelper('/api/jobs/job-api-1/tasks', 'GET', null, { 'x-tenant-id': 'tenant-api' });
    assert.equal(listTasksRes.statusCode, 200);
    assert.equal(listTasksRes.data.tasks.length, 1);
    assert.equal(listTasksRes.data.tasks[0].id, 'task-api-1');

    // 6. GET /api/tasks/:id
    const getTaskRes = await requestHelper('/api/tasks/task-api-1', 'GET', null, { 'x-tenant-id': 'tenant-api' });
    assert.equal(getTaskRes.statusCode, 200);
    assert.equal(getTaskRes.data.task.id, 'task-api-1');

    // 7. POST /api/tasks/:id/state
    const updateTaskRes = await requestHelper('/api/tasks/task-api-1/state', 'POST', {
      status: TaskState.READY,
      reason: 'Ready for execution',
      tenantId: 'tenant-api'
    });
    assert.equal(updateTaskRes.statusCode, 200);
    assert.equal(updateTaskRes.data.task.status, TaskState.READY);

    // 8. Cross-tenant rejection via HTTP
    const crossTenantRes = await requestHelper('/api/jobs/job-api-1', 'GET', null, { 'x-tenant-id': 'unauthorized-tenant' });
    assert.equal(crossTenantRes.statusCode, 400);
    assert.ok(crossTenantRes.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

// ============================================================================
// FAZ 38.2 Job-Scoped Execution/Mutation Authority Remediation (DEF-01) Tests
// ============================================================================

test('FAZ 38.2 - TEST A & B: Job A uses Plan A, Job B uses Plan B concurrently without interference', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-2-ab-'));
  const engine = createJobEngine();

  const executedCommands = [];
  const mockRunner = ({ command }) => {
    executedCommands.push(command);
    return {
      status: 'COMPLETED',
      executionResult: { outcome: 'SUCCEEDED', exitCode: 0, stdout: `ran: ${command}` }
    };
  };

  const mockAiGateway = {
    analyzeAndPlan: async ({ taskPrompt }) => {
      if (taskPrompt.includes('Task Alpha')) {
        return {
          intent: 'Intent Alpha',
          analysis: 'Analysis Alpha',
          proposedCommands: ['node -e "process.stdout.write(\'ALPHA\')"'],
          proposedFileChanges: ['alpha.txt'],
          proposedFileMutations: [{ file: 'alpha.txt', content: 'ALPHA_CONTENT' }],
          riskLevel: 'LOW'
        };
      } else {
        return {
          intent: 'Intent Beta',
          analysis: 'Analysis Beta',
          proposedCommands: ['node -e "process.stdout.write(\'BETA\')"'],
          proposedFileChanges: ['beta.txt'],
          proposedFileMutations: [{ file: 'beta.txt', content: 'BETA_CONTENT' }],
          riskLevel: 'LOW'
        };
      }
    }
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway,
    pipelineRunner: mockRunner
  });

  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const requestHelper = (pathName, method = 'GET', data = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(pathName, baseUrl);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
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
    // Select workspace
    const wsRes = await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });
    assert.equal(wsRes.statusCode, 200);

    // Create Job A and Job B
    await requestHelper('/api/jobs', 'POST', { id: 'job-A', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-B', projectId: 'p1', workflowId: 'w1' });

    // Plan for Job A
    const planARes = await requestHelper('/api/plan', 'POST', {
      jobId: 'job-A',
      task: 'Run Task Alpha'
    });
    assert.equal(planARes.statusCode, 200);
    const planAId = planARes.data.authoritativePlanId;

    // Plan for Job B
    const planBRes = await requestHelper('/api/plan', 'POST', {
      jobId: 'job-B',
      task: 'Run Task Beta'
    });
    assert.equal(planBRes.statusCode, 200);
    const planBId = planBRes.data.authoritativePlanId;

    assert.notEqual(planAId, planBId, 'Plan IDs must be distinct');

    // Retrieve plans from job engine directly to verify independent binding
    const storedPlanA = engine.getJobPlan('job-A');
    const storedPlanB = engine.getJobPlan('job-B');
    assert.equal(storedPlanA.id, planAId);
    assert.equal(storedPlanB.id, planBId);
    assert.deepEqual(storedPlanA.expectedCommands, ['node -e "process.stdout.write(\'ALPHA\')"']);
    assert.deepEqual(storedPlanB.expectedCommands, ['node -e "process.stdout.write(\'BETA\')"']);

    // Execute Job A
    const execARes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-A',
      command: 'node -e "process.stdout.write(\'ALPHA\')"',
      planId: planAId,
      taskId: storedPlanA.taskId
    });
    assert.equal(execARes.statusCode, 200);
    assert.equal(executedCommands[executedCommands.length - 1], 'node -e "process.stdout.write(\'ALPHA\')"');

    // Execute Job B
    const execBRes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-B',
      command: 'node -e "process.stdout.write(\'BETA\')"',
      planId: planBId,
      taskId: storedPlanB.taskId
    });
    assert.equal(execBRes.statusCode, 200);
    assert.equal(executedCommands[executedCommands.length - 1], 'node -e "process.stdout.write(\'BETA\')"');

    // Cross execution check: executing Job A with Plan B command/planId MUST fail closed
    const crossExec = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-A',
      command: 'node -e "process.stdout.write(\'BETA\')"',
      planId: planBId,
      taskId: storedPlanB.taskId
    });
    assert.equal(crossExec.statusCode, 400);
    assert.ok(crossExec.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 38.2 - TEST C: Plan replacement remains Job-scoped without affecting other jobs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-2-c-'));
  const engine = createJobEngine();

  let planCount = 0;
  const mockAiGateway = {
    analyzeAndPlan: async () => {
      planCount++;
      return {
        intent: `Intent ${planCount}`,
        analysis: 'Analysis',
        proposedCommands: [`cmd-${planCount}`],
        proposedFileChanges: [`file-${planCount}.txt`],
        proposedFileMutations: [{ file: `file-${planCount}.txt`, content: `content-${planCount}` }],
        riskLevel: 'LOW'
      };
    }
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway
  });

  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

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
    await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });
    await requestHelper('/api/jobs', 'POST', { id: 'job-C1', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-C2', projectId: 'p1', workflowId: 'w1' });

    // Plan for C1 (planCount = 1)
    await requestHelper('/api/plan', 'POST', { jobId: 'job-C1', task: 'Task 1' });
    // Plan for C2 (planCount = 2)
    await requestHelper('/api/plan', 'POST', { jobId: 'job-C2', task: 'Task 2' });

    const c2PlanBefore = engine.getJobPlan('job-C2');
    assert.deepEqual(c2PlanBefore.expectedCommands, ['cmd-2']);

    // Replace plan for C1 (planCount = 3)
    await requestHelper('/api/plan', 'POST', { jobId: 'job-C1', task: 'Task 1 Replanned' });

    const c1PlanAfter = engine.getJobPlan('job-C1');
    const c2PlanAfter = engine.getJobPlan('job-C2');

    assert.deepEqual(c1PlanAfter.expectedCommands, ['cmd-3']);
    // C2 plan MUST NOT change
    assert.deepEqual(c2PlanAfter.expectedCommands, ['cmd-2']);
    assert.equal(c2PlanAfter.id, c2PlanBefore.id);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 38.2 - TEST D: Missing Job plan fails closed (no fallback to other jobs or global state)', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-2-d-'));
  const engine = createJobEngine();

  const mockAiGateway = {
    analyzeAndPlan: async () => ({
      intent: 'Intent',
      analysis: 'Analysis',
      proposedCommands: ['node --version'],
      proposedFileChanges: ['file.txt'],
      proposedFileMutations: [{ file: 'file.txt', content: 'data' }],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway
  });

  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

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
    await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });
    await requestHelper('/api/jobs', 'POST', { id: 'job-with-plan', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-no-plan', projectId: 'p1', workflowId: 'w1' });

    // Plan for job-with-plan
    await requestHelper('/api/plan', 'POST', { jobId: 'job-with-plan', task: 'Generate plan' });

    // Try to execute job-no-plan -> MUST fail closed
    const execRes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-no-plan',
      command: 'node --version'
    });
    assert.equal(execRes.statusCode, 400);
    assert.ok(execRes.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(execRes.data.error, /No authoritative plan exists for Job 'job-no-plan'/);

    // Try to mutate job-no-plan -> MUST fail closed
    const mutRes = await requestHelper('/api/mutate', 'POST', {
      jobId: 'job-no-plan',
      targetPath: 'file.txt',
      content: 'data'
    });
    assert.equal(mutRes.statusCode, 400);
    assert.ok(mutRes.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(mutRes.data.error, /No authoritative plan exists for Job 'job-no-plan'/);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 38.2 - TEST E & F: Cross-tenant execution and mutation fail closed with SECURITY_BLOCKED', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-2-ef-'));
  const engine = createJobEngine();

  const mockAiGateway = {
    analyzeAndPlan: async () => ({
      intent: 'Intent',
      analysis: 'Analysis',
      proposedCommands: ['echo secure'],
      proposedFileChanges: ['tenant.txt'],
      proposedFileMutations: [{ file: 'tenant.txt', content: 'tenant-secret' }],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway
  });

  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const requestHelper = (pathName, method = 'GET', data = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(pathName, baseUrl);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
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

    // Create Job owned by tenant-A
    await requestHelper('/api/jobs', 'POST', {
      id: 'job-tenant-A',
      projectId: 'p1',
      workflowId: 'w1',
      tenantId: 'tenant-A'
    });

    // Create plan for tenant-A job
    const planRes = await requestHelper('/api/plan', 'POST', {
      jobId: 'job-tenant-A',
      tenantId: 'tenant-A',
      task: 'Tenant Task'
    });
    assert.equal(planRes.statusCode, 200);
    const planId = planRes.data.authoritativePlanId;

    // Cross-tenant execute attempt (caller claims tenant-B) -> MUST FAIL
    const crossExec = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-tenant-A',
      tenantId: 'tenant-B',
      command: 'echo secure',
      planId
    });
    assert.equal(crossExec.statusCode, 400);
    assert.ok(crossExec.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(crossExec.data.error, /Tenant mismatch/);

    // Cross-tenant mutate attempt (caller claims tenant-B) -> MUST FAIL
    const crossMut = await requestHelper('/api/mutate', 'POST', {
      jobId: 'job-tenant-A',
      tenantId: 'tenant-B',
      targetPath: 'tenant.txt',
      content: 'tenant-secret',
      planId
    });
    assert.equal(crossMut.statusCode, 400);
    assert.ok(crossMut.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(crossMut.data.error, /Tenant mismatch/);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 38.2 - TEST G: Legacy global plan cannot influence Job execution', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz38-2-g-'));
  const engine = createJobEngine();

  let calls = 0;
  const mockAiGateway = {
    analyzeAndPlan: async () => {
      calls++;
      if (calls === 1) {
        // First plan: non-job legacy plan
        return {
          intent: 'Legacy Plan',
          analysis: 'Analysis',
          proposedCommands: ['echo legacy'],
          proposedFileChanges: ['legacy.txt'],
          proposedFileMutations: [{ file: 'legacy.txt', content: 'legacy-data' }],
          riskLevel: 'LOW'
        };
      } else {
        // Second plan: Job A plan
        return {
          intent: 'Job A Plan',
          analysis: 'Analysis',
          proposedCommands: ['echo jobA'],
          proposedFileChanges: ['jobA.txt'],
          proposedFileMutations: [{ file: 'jobA.txt', content: 'jobA-data' }],
          riskLevel: 'LOW'
        };
      }
    }
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway
  });

  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

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
    await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });

    // Step 1: Create a non-job legacy plan
    const legacyPlanRes = await requestHelper('/api/plan', 'POST', {
      task: 'Legacy non-job plan'
    });
    assert.equal(legacyPlanRes.statusCode, 200);
    const legacyPlanId = legacyPlanRes.data.authoritativePlanId;

    // Step 2: Create Job A
    await requestHelper('/api/jobs', 'POST', { id: 'job-isolated-A', projectId: 'p1', workflowId: 'w1' });

    // Step 3: Attempting to execute Job A using legacy plan -> MUST FAIL CLOSED
    const failExec = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-isolated-A',
      command: 'echo legacy',
      planId: legacyPlanId
    });
    assert.equal(failExec.statusCode, 400);
    assert.ok(failExec.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(failExec.data.error, /No authoritative plan exists for Job 'job-isolated-A'/);

    // Step 4: Create authoritative plan for Job A
    const jobAPlanRes = await requestHelper('/api/plan', 'POST', {
      jobId: 'job-isolated-A',
      task: 'Job A real plan'
    });
    assert.equal(jobAPlanRes.statusCode, 200);

    // Step 5: Executing Job A with legacy plan ID MUST FAIL CLOSED even though Job A has a plan
    const failPlanMismatch = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-isolated-A',
      command: 'echo jobA',
      planId: legacyPlanId
    });
    assert.equal(failPlanMismatch.statusCode, 400);
    assert.ok(failPlanMismatch.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ============================================================================
