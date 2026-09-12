/**
 * FAZ 39 Test Suite: Controlled Autonomous Execution Foundation
 *
 * Verifies:
 * - Deterministic Execution Result Storage & Invariants
 * - Atomic Disk Persistence of Execution History
 * - Fail-Closed Execution Isolation across Jobs and Tenants
 * - Bounded Declarative Retry Foundation (MAX_RETRIES = 0 default, zero auto-loops)
 * - Independent Job-Scoped Authority & Result Recording
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
// FAZ 39: Controlled Autonomous Execution Foundation Tests
// ============================================================================

test('FAZ 39 - TEST 1 & 2: Job A -> Plan A -> Execute A and Job B -> Plan B -> Execute B record results correctly', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t1-t2-'));
  const engine = createJobEngine();

  const executed = [];
  const mockRunner = ({ command }) => {
    executed.push(command);
    return {
      status: 'COMPLETED',
      executionResult: { outcome: 'SUCCEEDED', exitCode: 0, stdout: `executed: ${command}` }
    };
  };

  const mockAiGateway = {
    analyzeAndPlan: async ({ taskPrompt }) => {
      if (taskPrompt.includes('Alpha')) {
        return {
          intent: 'Alpha Intent',
          analysis: 'Alpha Analysis',
          proposedCommands: ['node -e "process.stdout.write(\'A\')"'],
          proposedFileChanges: ['a.txt'],
          proposedFileMutations: [{ file: 'a.txt', content: 'AAA' }],
          riskLevel: 'LOW'
        };
      }
      return {
        intent: 'Beta Intent',
        analysis: 'Beta Analysis',
        proposedCommands: ['node -e "process.stdout.write(\'B\')"'],
        proposedFileChanges: ['b.txt'],
        proposedFileMutations: [{ file: 'b.txt', content: 'BBB' }],
        riskLevel: 'LOW'
      };
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
    await requestHelper('/api/workspace', 'POST', { rootPath: tempDir });
    await requestHelper('/api/jobs', 'POST', { id: 'job-39-A', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-39-B', projectId: 'p1', workflowId: 'w1' });

    // Plan A
    const planARes = await requestHelper('/api/plan', 'POST', { jobId: 'job-39-A', task: 'Alpha Task' });
    assert.equal(planARes.statusCode, 200);
    const planAId = planARes.data.authoritativePlanId;
    const planA = engine.getJobPlan('job-39-A');

    // Plan B
    const planBRes = await requestHelper('/api/plan', 'POST', { jobId: 'job-39-B', task: 'Beta Task' });
    assert.equal(planBRes.statusCode, 200);
    const planBId = planBRes.data.authoritativePlanId;
    const planB = engine.getJobPlan('job-39-B');

    // Execute Job A
    const execARes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-39-A',
      command: 'node -e "process.stdout.write(\'A\')"',
      planId: planAId,
      taskId: planA.taskId
    });
    assert.equal(execARes.statusCode, 200);

    // Verify Job A execution result recorded
    const resultsARes = await requestHelper('/api/jobs/job-39-A/results', 'GET');
    assert.equal(resultsARes.statusCode, 200);
    assert.equal(resultsARes.data.results.length, 1);
    assert.equal(resultsARes.data.results[0].jobId, 'job-39-A');
    assert.equal(resultsARes.data.results[0].planId, planAId);
    assert.equal(resultsARes.data.results[0].taskId, planA.taskId);
    assert.equal(resultsARes.data.results[0].outcome, 'SUCCEEDED');

    // Execute Job B
    const execBRes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-39-B',
      command: 'node -e "process.stdout.write(\'B\')"',
      planId: planBId,
      taskId: planB.taskId
    });
    assert.equal(execBRes.statusCode, 200);

    // Verify Job B execution result recorded
    const resultsBRes = await requestHelper('/api/jobs/job-39-B/results', 'GET');
    assert.equal(resultsBRes.statusCode, 200);
    assert.equal(resultsBRes.data.results.length, 1);
    assert.equal(resultsBRes.data.results[0].jobId, 'job-39-B');
    assert.equal(resultsBRes.data.results[0].planId, planBId);
    assert.equal(resultsBRes.data.results[0].taskId, planB.taskId);
    assert.equal(resultsBRes.data.results[0].outcome, 'SUCCEEDED');

    // Verify results on Job A remain isolated and unchanged
    const resultsAAfter = engine.listJobExecutionResults('job-39-A');
    assert.equal(resultsAAfter.length, 1);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 3 & 4: Cross-plan execution (Job A + Plan B or Job B + Plan A) fails closed', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t3-t4-'));
  const engine = createJobEngine();

  const mockAiGateway = {
    analyzeAndPlan: async ({ taskPrompt }) => ({
      intent: 'Intent',
      analysis: 'Analysis',
      proposedCommands: taskPrompt.includes('A') ? ['cmd-A'] : ['cmd-B'],
      proposedFileChanges: ['f.txt'],
      proposedFileMutations: [{ file: 'f.txt', content: 'data' }],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({ jobEngine: engine, aiGateway: mockAiGateway });
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
    await requestHelper('/api/jobs', 'POST', { id: 'job-39-cross-A', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-39-cross-B', projectId: 'p1', workflowId: 'w1' });

    const pARes = await requestHelper('/api/plan', 'POST', { jobId: 'job-39-cross-A', task: 'Plan A' });
    const pBRes = await requestHelper('/api/plan', 'POST', { jobId: 'job-39-cross-B', task: 'Plan B' });

    const planAId = pARes.data.authoritativePlanId;
    const planBId = pBRes.data.authoritativePlanId;

    const planA = engine.getJobPlan('job-39-cross-A');
    const planB = engine.getJobPlan('job-39-cross-B');

    // Test 3: Job A + Plan B -> FAIL CLOSED
    const failA = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-39-cross-A',
      command: 'cmd-B',
      planId: planBId,
      taskId: planB.taskId
    });
    assert.equal(failA.statusCode, 400);
    assert.ok(failA.data.error.includes(ErrorCodes.SECURITY_BLOCKED));

    // Test 4: Job B + Plan A -> FAIL CLOSED
    const failB = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-39-cross-B',
      command: 'cmd-A',
      planId: planAId,
      taskId: planA.taskId
    });
    assert.equal(failB.statusCode, 400);
    assert.ok(failB.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 5: Job without plan execution fails closed', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t5-'));
  const engine = createJobEngine();
  const server = createApplicationServer({ jobEngine: engine });
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
    await requestHelper('/api/jobs', 'POST', { id: 'job-no-plan-39', projectId: 'p1', workflowId: 'w1' });

    const execRes = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-no-plan-39',
      command: 'node --version'
    });
    assert.equal(execRes.statusCode, 400);
    assert.ok(execRes.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(execRes.data.error, /No authoritative plan exists for Job/);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 6 & 7: Cross-tenant execution and mutation fail closed with SECURITY_BLOCKED', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t6-t7-'));
  const engine = createJobEngine();

  const mockAiGateway = {
    analyzeAndPlan: async () => ({
      intent: 'Tenant Intent',
      analysis: 'Tenant Analysis',
      proposedCommands: ['echo secret'],
      proposedFileChanges: ['tenant.txt'],
      proposedFileMutations: [{ file: 'tenant.txt', content: 'tenant-data' }],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({ jobEngine: engine, aiGateway: mockAiGateway });
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
    await requestHelper('/api/jobs', 'POST', {
      id: 'job-tenant-X',
      projectId: 'p1',
      workflowId: 'w1',
      tenantId: 'tenant-X'
    });

    const planRes = await requestHelper('/api/plan', 'POST', {
      jobId: 'job-tenant-X',
      tenantId: 'tenant-X',
      task: 'Tenant Task'
    });
    assert.equal(planRes.statusCode, 200);
    const planId = planRes.data.authoritativePlanId;

    // Test 6: Cross-tenant execution
    const crossExec = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-tenant-X',
      tenantId: 'tenant-Y',
      command: 'echo secret',
      planId
    });
    assert.equal(crossExec.statusCode, 400);
    assert.ok(crossExec.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(crossExec.data.error, /Tenant mismatch/);

    // Test 7: Cross-tenant mutation
    const crossMut = await requestHelper('/api/mutate', 'POST', {
      jobId: 'job-tenant-X',
      tenantId: 'tenant-Y',
      targetPath: 'tenant.txt',
      content: 'tenant-data',
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

test('FAZ 39 - TEST 8: Legacy global plan cannot influence or authorize Job execution', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t8-'));
  const engine = createJobEngine();

  const mockAiGateway = {
    analyzeAndPlan: async () => ({
      intent: 'Legacy Intent',
      analysis: 'Analysis',
      proposedCommands: ['node -v'],
      proposedFileChanges: [],
      proposedFileMutations: [],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({ jobEngine: engine, aiGateway: mockAiGateway });
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

    // Legacy plan without jobId
    const legacyRes = await requestHelper('/api/plan', 'POST', { task: 'Legacy prompt' });
    assert.equal(legacyRes.statusCode, 200);
    const legacyPlanId = legacyRes.data.authoritativePlanId;

    // Create Job
    await requestHelper('/api/jobs', 'POST', { id: 'job-isolated-39', projectId: 'p1', workflowId: 'w1' });

    // Try executing Job with legacy plan ID -> MUST FAIL CLOSED
    const failExec = await requestHelper('/api/execute', 'POST', {
      jobId: 'job-isolated-39',
      command: 'node -v',
      planId: legacyPlanId
    });
    assert.equal(failExec.statusCode, 400);
    assert.ok(failExec.data.error.includes(ErrorCodes.SECURITY_BLOCKED));
    assert.match(failExec.data.error, /No authoritative plan exists for Job/);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 9: Plan replacement on Job A does not affect Job B', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-t9-'));
  const engine = createJobEngine();

  let counter = 0;
  const mockAiGateway = {
    analyzeAndPlan: async () => {
      counter++;
      return {
        intent: `Intent-${counter}`,
        analysis: 'Analysis',
        proposedCommands: [`cmd-${counter}`],
        proposedFileChanges: [],
        proposedFileMutations: [],
        riskLevel: 'LOW'
      };
    }
  };

  const server = createApplicationServer({ jobEngine: engine, aiGateway: mockAiGateway });
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
    await requestHelper('/api/jobs', 'POST', { id: 'job-rep-A', projectId: 'p1', workflowId: 'w1' });
    await requestHelper('/api/jobs', 'POST', { id: 'job-rep-B', projectId: 'p1', workflowId: 'w1' });

    await requestHelper('/api/plan', 'POST', { jobId: 'job-rep-A', task: 'Plan A1' });
    await requestHelper('/api/plan', 'POST', { jobId: 'job-rep-B', task: 'Plan B1' });

    const planBBefore = engine.getJobPlan('job-rep-B');

    // Replace Plan A
    await requestHelper('/api/plan', 'POST', { jobId: 'job-rep-A', task: 'Plan A2' });

    const planAAfter = engine.getJobPlan('job-rep-A');
    const planBAfter = engine.getJobPlan('job-rep-B');

    assert.deepEqual(planAAfter.expectedCommands, ['cmd-3']);
    assert.deepEqual(planBAfter.expectedCommands, planBBefore.expectedCommands);
    assert.equal(planBAfter.id, planBBefore.id);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 10: Execution result on Job A does not alter or contaminate Job B state or results', async () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-iso-res-A', projectId: 'p1', workflowId: 'w1' });
  engine.createJob({ id: 'job-iso-res-B', projectId: 'p1', workflowId: 'w1' });

  engine.recordExecutionResult('job-iso-res-A', {
    taskId: 'task-A',
    planId: 'plan-A',
    outcome: 'SUCCEEDED',
    result: { output: 'Success on A' }
  });

  const resultsA = engine.listJobExecutionResults('job-iso-res-A');
  const resultsB = engine.listJobExecutionResults('job-iso-res-B');

  assert.equal(resultsA.length, 1);
  assert.equal(resultsA[0].jobId, 'job-iso-res-A');
  assert.equal(resultsB.length, 0, 'Job B must have 0 execution results');
});

test('FAZ 39 - TEST 11: Concurrency isolation: Concurrent Jobs A, B, C preserve isolation without contamination', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-concur-'));
  const engine = createJobEngine();

  const mockRunner = ({ command }) => ({
    status: 'COMPLETED',
    executionResult: { outcome: 'SUCCEEDED', exitCode: 0, stdout: `done: ${command}` }
  });

  const mockAiGateway = {
    analyzeAndPlan: async ({ taskPrompt }) => ({
      intent: `Intent for ${taskPrompt}`,
      analysis: 'Analysis',
      proposedCommands: [`cmd-${taskPrompt}`],
      proposedFileChanges: [],
      proposedFileMutations: [],
      riskLevel: 'LOW'
    })
  };

  const server = createApplicationServer({
    jobEngine: engine,
    aiGateway: mockAiGateway,
    pipelineRunner: mockRunner
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

    const jobIds = ['job-concur-1', 'job-concur-2', 'job-concur-3'];
    await Promise.all(jobIds.map(id => requestHelper('/api/jobs', 'POST', { id, projectId: 'p1', workflowId: 'w1' })));

    // Concurrent planning
    const plans = await Promise.all(jobIds.map(id => requestHelper('/api/plan', 'POST', { jobId: id, task: id })));
    plans.forEach(p => assert.equal(p.statusCode, 200));

    // Concurrent execution
    const execs = await Promise.all(jobIds.map(id => {
      const plan = engine.getJobPlan(id);
      return requestHelper('/api/execute', 'POST', {
        jobId: id,
        command: `cmd-${id}`,
        planId: plan.id,
        taskId: plan.taskId
      });
    }));
    execs.forEach(e => assert.equal(e.statusCode, 200));

    // Verify isolation for all 3
    for (const id of jobIds) {
      const results = engine.listJobExecutionResults(id);
      assert.equal(results.length, 1);
      assert.equal(results[0].jobId, id);
      assert.equal(results[0].taskId, engine.getJobPlan(id).taskId);
      assert.equal(results[0].outcome, 'SUCCEEDED');
    }
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 39 - TEST 12: Bounded retry foundation: MAX_RETRIES = 0 by default, retries blocked fail-closed', () => {
  const engine = createJobEngine();
  engine.createJob({ id: 'job-retry-test', projectId: 'p1', workflowId: 'w1' });

  // Default maxRetries = 0: retry check MUST return false
  assert.equal(engine.isRetryAllowed('job-retry-test', 0), false);
  assert.equal(engine.isRetryAllowed('job-retry-test', 0, { maxRetries: 0 }), false);
  assert.equal(engine.isRetryAllowed('job-retry-test', 1, { maxRetries: 0 }), false);

  // If explicitly configured with positive bound
  assert.equal(engine.isRetryAllowed('job-retry-test', 0, { maxRetries: 2 }), true);
  assert.equal(engine.isRetryAllowed('job-retry-test', 1, { maxRetries: 2 }), true);
  assert.equal(engine.isRetryAllowed('job-retry-test', 2, { maxRetries: 2 }), false);

  // Invalid / negative bounds fail-closed
  assert.equal(engine.isRetryAllowed('job-retry-test', 0, { maxRetries: -1 }), false);
  assert.equal(engine.isRetryAllowed('job-retry-test', 0, { maxRetries: 'invalid' }), false);
});

test('FAZ 39 - TEST 13: Deterministic persistence of execution results survives process restart', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz39-persist-'));

  try {
    // Phase 1: Create engine with storageDir and record results
    const engine1 = createJobEngine({ storageDir: tempDir });
    engine1.createJob({ id: 'job-persisted', projectId: 'p1', workflowId: 'w1' });
    engine1.recordExecutionResult('job-persisted', {
      taskId: 'task-persist-1',
      planId: 'plan-persist-1',
      outcome: 'SUCCEEDED',
      result: { code: 0, details: 'output' }
    });

    const results1 = engine1.listJobExecutionResults('job-persisted');
    assert.equal(results1.length, 1);

    // Phase 2: Create brand new engine instance from same storageDir
    const engine2 = createJobEngine({ storageDir: tempDir });
    const reloadedJob = engine2.getJob('job-persisted');
    assert.equal(reloadedJob.id, 'job-persisted');

    const results2 = engine2.listJobExecutionResults('job-persisted');
    assert.equal(results2.length, 1);
    assert.equal(results2[0].jobId, 'job-persisted');
    assert.equal(results2[0].taskId, 'task-persist-1');
    assert.equal(results2[0].planId, 'plan-persist-1');
    assert.equal(results2[0].outcome, 'SUCCEEDED');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
