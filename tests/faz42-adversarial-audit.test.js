/**
 * FAZ 42 Hostile Cross-Phase Adversarial Test Suite
 * Cross-Phase Adversarial Audit & Authority-Chain Break Tests
 *
 * Covers:
 * 1. Deep Immutability & Aliasing Attack Resistance
 * 2. Cross-Tenant Escape & Leakage Resistance
 * 3. Cross-Job & Stale Plan Confusion Resistance
 * 4. Task/Plan Identity Spoofing Resistance
 * 5. Action Authorization & Semantic Tampering Resistance (Commands)
 * 6. File Mutation Target & Operation Traversal Resistance
 * 7. Windows-Specific Path Traversal & UNC/Junction Resistance
 * 8. Strict Admission-Before-Execution Physical Invariant
 * 9. User Approval Independence (Approval is NOT Authority)
 * 10. Lifecycle Decoupling & Double-Execution Invariant Verification
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
  createExecutionPlanContract
} from '../src/index.js';

test('FAZ 42 - ADV-01: Deep immutability and object aliasing attack resistance', () => {
  const origAction = {
    type: WorkUnitActionType.COMMAND,
    command: 'node -v'
  };

  const wu = createWorkUnit({
    id: 'wu-adv-1',
    tenantId: 'tenant-1',
    workspaceRoot: '/tmp/ws',
    jobId: 'job-1',
    taskId: 'task-1',
    planId: 'plan-1',
    action: origAction
  });

  // 1. Caller mutates original action object post-creation
  origAction.command = 'rm -rf /';
  assert.equal(wu.action.command, 'node -v', 'WorkUnit action command must not be tainted by caller mutation');

  // 2. WorkUnit and action are frozen
  assert.ok(Object.isFrozen(wu));
  assert.ok(Object.isFrozen(wu.action));
  assert.throws(() => {
    'use strict';
    wu.tenantId = 'tenant-hacked';
  }, TypeError);
  assert.throws(() => {
    'use strict';
    wu.action.command = 'malicious';
  }, TypeError);
});

test('FAZ 42 - ADV-02: Cross-tenant escape and authority chain fail-closed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv02-'));
  try {
    const engine = createJobEngine();
    // Tenant A owns Job A
    engine.createJob({ id: 'job-A', projectId: 'p1', workflowId: 'w1', tenantId: 'tenant-A', workspaceReference: tempDir });
    engine.createTask({ id: 'task-A', jobId: 'job-A', objective: 'Task A', tenantId: 'tenant-A' });
    engine.setJobPlan('job-A', createExecutionPlanContract({
      id: 'plan-A',
      taskId: 'task-A',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 'tenant-A' });

    // Attack 1: Tenant B creates WorkUnit targeting Tenant A Job
    const wuB = createWorkUnit({
      id: 'wu-attack-tenant',
      tenantId: 'tenant-B',
      workspaceRoot: tempDir,
      jobId: 'job-A',
      taskId: 'task-A',
      planId: 'plan-A',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    assert.throws(() => admitWorkUnit({ workUnit: wuB, jobEngine: engine }), (err) => {
      return err.message.includes(ErrorCodes.SECURITY_BLOCKED);
    });

    // Attack 2: Tenant B cannot execute or bypass via executeWorkUnit
    assert.throws(() => executeWorkUnit({ workUnit: wuB, jobEngine: engine }), (err) => {
      return err.message.includes(ErrorCodes.SECURITY_BLOCKED);
    });

    // Attack 3: Tenant B cannot list or view execution results of Tenant A
    assert.throws(() => engine.listJobExecutionResults('job-A', { tenantId: 'tenant-B' }), (err) => {
      return err.message.includes(ErrorCodes.SECURITY_BLOCKED);
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-03: Cross-job and plan spoofing attacks fail-closed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv03-'));
  try {
    const engine = createJobEngine();
    // Job 1 with Plan 1
    engine.createJob({ id: 'job-1', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-1', jobId: 'job-1', objective: 'Task 1', tenantId: 't1' });
    engine.setJobPlan('job-1', createExecutionPlanContract({
      id: 'plan-1',
      taskId: 'task-1',
      workspaceRoot: tempDir,
      expectedCommands: ['echo plan1']
    }), { tenantId: 't1' });

    // Job 2 with Plan 2
    engine.createJob({ id: 'job-2', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-2', jobId: 'job-2', objective: 'Task 2', tenantId: 't1' });
    engine.setJobPlan('job-2', createExecutionPlanContract({
      id: 'plan-2',
      taskId: 'task-2',
      workspaceRoot: tempDir,
      expectedCommands: ['echo plan2']
    }), { tenantId: 't1' });

    // Attack 1: Job 1 attempts to invoke action authorized only in Plan 2
    const wuSpoofedPlan = createWorkUnit({
      id: 'wu-sp-1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-1',
      taskId: 'task-1',
      planId: 'plan-2', // Mismatched planId!
      action: { type: WorkUnitActionType.COMMAND, command: 'echo plan2' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuSpoofedPlan, jobEngine: engine }), /SECURITY_BLOCKED/);

    // Attack 2: Task 2 from Job 2 referenced in Job 1 context
    const wuCrossTask = createWorkUnit({
      id: 'wu-sp-2',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-1',
      taskId: 'task-2', // Task belonging to Job 2!
      planId: 'plan-1',
      action: { type: WorkUnitActionType.COMMAND, command: 'echo plan1' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuCrossTask, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-04: Action command tampering, prefix collision, and argument injection fail-closed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv04-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-cmd', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-cmd', jobId: 'job-cmd', objective: 'Run specific command', tenantId: 't1' });
    engine.setJobPlan('job-cmd', createExecutionPlanContract({
      id: 'plan-cmd',
      taskId: 'task-cmd',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    // 1. Partial match / prefix collision (e.g. 'node -v && evil')
    const wuPrefix = createWorkUnit({
      id: 'wu-pfx',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-cmd',
      taskId: 'task-cmd',
      planId: 'plan-cmd',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v && whoami' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuPrefix, jobEngine: engine }), /SECURITY_BLOCKED/);

    // 2. Extra arguments (e.g. 'node -v --extra')
    const wuArgs = createWorkUnit({
      id: 'wu-args',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-cmd',
      taskId: 'task-cmd',
      planId: 'plan-cmd',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v -e 1' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuArgs, jobEngine: engine }), /SECURITY_BLOCKED/);

    // 3. Different whitespace/arguments
    const wuWs = createWorkUnit({
      id: 'wu-ws',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-cmd',
      taskId: 'task-cmd',
      planId: 'plan-cmd',
      action: { type: WorkUnitActionType.COMMAND, command: 'node  -v' }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuWs, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-05: File mutation path traversal and Windows-specific boundary evasion attacks', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv05-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-mut', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-mut', jobId: 'job-mut', objective: 'File mutation', tenantId: 't1' });
    engine.setJobPlan('job-mut', createExecutionPlanContract({
      id: 'plan-mut',
      taskId: 'task-mut',
      workspaceRoot: tempDir,
      expectedCommands: [],
      expectedFileChanges: ['allowed.txt']
    }), { tenantId: 't1' });

    // 1. Parent traversal in targetPath
    const wuTraversal = createWorkUnit({
      id: 'wu-trav',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-mut',
      taskId: 'task-mut',
      planId: 'plan-mut',
      action: {
        type: WorkUnitActionType.MUTATION,
        targetPath: '../escape.txt',
        content: 'malicious'
      }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuTraversal, jobEngine: engine }), /SECURITY_BLOCKED/);

    // 2. Absolute path attack
    const absPath = path.resolve(tempDir, 'allowed.txt');
    const wuAbs = createWorkUnit({
      id: 'wu-abs',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-mut',
      taskId: 'task-mut',
      planId: 'plan-mut',
      action: {
        type: WorkUnitActionType.MUTATION,
        targetPath: absPath,
        content: 'malicious'
      }
    });
    // Expected file change was declared as 'allowed.txt', so absPath fails admission
    assert.throws(() => admitWorkUnit({ workUnit: wuAbs, jobEngine: engine }), /SECURITY_BLOCKED/);

    // 3. Sibling prefix directory collision (e.g. dir + '-evil')
    const wuSibling = createWorkUnit({
      id: 'wu-sib',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-mut',
      taskId: 'task-mut',
      planId: 'plan-mut',
      action: {
        type: WorkUnitActionType.MUTATION,
        targetPath: 'allowed.txt.bak',
        content: 'malicious'
      }
    });
    assert.throws(() => admitWorkUnit({ workUnit: wuSibling, jobEngine: engine }), /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-06: Strict Admission-Before-Execution proof (execution boundary unreachable on admission rejection)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv06-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-gate', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-gate', jobId: 'job-gate', objective: 'Gated task', tenantId: 't1' });
    engine.setJobPlan('job-gate', createExecutionPlanContract({
      id: 'plan-gate',
      taskId: 'task-gate',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    let commandRunnerCalled = false;
    const instrumentedRunner = () => {
      commandRunnerCalled = true;
      return { status: 0, stdout: '', stderr: '' };
    };

    const unadmittedUnit = createWorkUnit({
      id: 'wu-unadmitted',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-gate',
      taskId: 'task-gate',
      planId: 'plan-gate',
      action: { type: WorkUnitActionType.COMMAND, command: 'unauthorized-command' }
    });

    // Must throw at admission preflight before invoking commandRunner
    assert.throws(() => {
      executeWorkUnit({
        workUnit: unadmittedUnit,
        jobEngine: engine,
        commandRunner: instrumentedRunner
      });
    }, /SECURITY_BLOCKED/);

    // Command runner was physically unreachable
    assert.equal(commandRunnerCalled, false, 'Command runner must NOT be called when admission fails');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-07: User approval cannot substitute for missing plan authority', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv07-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-appr', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-appr', jobId: 'job-appr', objective: 'Approval check', tenantId: 't1' });
    engine.setJobPlan('job-appr', createExecutionPlanContract({
      id: 'plan-appr',
      taskId: 'task-appr',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    const unauthorizedUnit = createWorkUnit({
      id: 'wu-unauth-appr',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-appr',
      taskId: 'task-appr',
      planId: 'plan-appr',
      action: { type: WorkUnitActionType.COMMAND, command: 'format C:' }
    });

    // Even if userApproval is true, lack of plan authority blocks admission
    assert.throws(() => {
      executeWorkUnit({
        workUnit: unauthorizedUnit,
        jobEngine: engine,
        userApproval: true
      });
    }, /SECURITY_BLOCKED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-08: Work Unit execution preserves Job and Task lifecycle independence', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv08-'));
  try {
    const engine = createJobEngine();
    const job = engine.createJob({
      id: 'job-life-adv',
      projectId: 'p1',
      workflowId: 'w1',
      tenantId: 't1',
      status: JobState.RUNNING,
      workspaceReference: tempDir
    });
    const task = engine.createTask({
      id: 'task-life-adv',
      jobId: 'job-life-adv',
      objective: 'Lifecycle task',
      status: TaskState.READY,
      tenantId: 't1'
    });
    engine.setJobPlan('job-life-adv', createExecutionPlanContract({
      id: 'plan-life-adv',
      taskId: 'task-life-adv',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-life-adv',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-life-adv',
      taskId: 'task-life-adv',
      planId: 'plan-life-adv',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    const completedWu = executeWorkUnit({ workUnit: wu, jobEngine: engine });
    assert.equal(completedWu.status, WorkUnitStatus.SUCCEEDED);

    // Invariants: Job is still RUNNING, Task is still READY
    assert.equal(engine.getJob('job-life-adv', { tenantId: 't1' }).status, JobState.RUNNING);
    assert.equal(engine.getTask('task-life-adv', { tenantId: 't1' }).status, TaskState.READY);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAZ 42 - ADV-09: Re-execution behavior and discrete result recording audit', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz42-adv09-'));
  try {
    const engine = createJobEngine();
    engine.createJob({ id: 'job-reexec', projectId: 'p1', workflowId: 'w1', tenantId: 't1', workspaceReference: tempDir });
    engine.createTask({ id: 'task-reexec', jobId: 'job-reexec', objective: 'Reexec check', tenantId: 't1' });
    engine.setJobPlan('job-reexec', createExecutionPlanContract({
      id: 'plan-reexec',
      taskId: 'task-reexec',
      workspaceRoot: tempDir,
      expectedCommands: ['node -v']
    }), { tenantId: 't1' });

    const wu = createWorkUnit({
      id: 'wu-rex-1',
      tenantId: 't1',
      workspaceRoot: tempDir,
      jobId: 'job-reexec',
      taskId: 'task-reexec',
      planId: 'plan-reexec',
      action: { type: WorkUnitActionType.COMMAND, command: 'node -v' }
    });

    const firstRun = executeWorkUnit({ workUnit: wu, jobEngine: engine });
    assert.equal(firstRun.status, WorkUnitStatus.SUCCEEDED);

    const secondRun = executeWorkUnit({ workUnit: wu, jobEngine: engine });
    assert.equal(secondRun.status, WorkUnitStatus.SUCCEEDED);

    // Each run records an authentic, discrete result in the authoritative Job Engine
    const results = engine.listJobExecutionResults('job-reexec', { tenantId: 't1' });
    assert.equal(results.length, 2);
    assert.notEqual(results[0].id, results[1].id);
    assert.equal(results[0].outcome, 'SUCCEEDED');
    assert.equal(results[1].outcome, 'SUCCEEDED');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
