/**
 * AI Development OS - Authoritative Persistent Job & Task State Engine
 * Phase 38 Foundation - Task-Scoped Execution State + Multi-Job Isolation
 *
 * Enforces:
 * 1. Exactly ONE authoritative state owner for Jobs and Tasks.
 * 2. Multi-job & multi-task isolation (no cross-contamination, no global state leakage).
 * 3. Machine-readable, deterministic state transitions conforming to ValidJobTransitions & ValidTaskTransitions.
 * 4. Deterministic persistence surviving process restart (atomic file writes per entity).
 * 5. Deterministic tenant isolation and job-task parentage integrity.
 * 6. Task-scoped execution context (workspace, plan, task state).
 *
 * ZERO AUTONOMOUS LOOPS / ZERO QUEUES / ZERO SCHEDULERS / ZERO AI DECISION AUTHORITY
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  JobState,
  TaskState,
  ErrorCodes
} from './constants.js';
import {
  createJob,
  createTask,
  validateStateTransition
} from './domain.js';

export function createJobEngine({
  storageDir = null
} = {}) {
  // Persistence directory setup (if configured for disk persistence)
  let jobsDir = null;
  let tasksDir = null;
  let resultsDir = null;

  if (storageDir) {
    const resolvedBase = path.resolve(storageDir);
    jobsDir = path.join(resolvedBase, 'jobs');
    tasksDir = path.join(resolvedBase, 'tasks');
    resultsDir = path.join(resolvedBase, 'results');
    fs.mkdirSync(jobsDir, { recursive: true });
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Authoritative memory index (cache / source of truth when no storageDir, or populated on load)
  const jobs = new Map();
  const tasks = new Map();
  const jobPlans = new Map(); // jobId -> Authoritative Plan object
  const jobExecutionResults = new Map(); // jobId -> Array of execution records

  function persistJob(job) {
    if (!jobsDir) return;
    const filePath = path.join(jobsDir, `${job.id}.json`);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(job, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  function persistTask(task) {
    if (!tasksDir) return;
    const filePath = path.join(tasksDir, `${task.id}.json`);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(task, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  function persistExecutionResult(record) {
    if (!resultsDir) return;
    const filePath = path.join(resultsDir, `${record.id}.json`);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(record, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  // Load existing persistent state on startup if storageDir provided
  if (jobsDir && fs.existsSync(jobsDir)) {
    const jobFiles = fs.readdirSync(jobsDir).filter(f => f.endsWith('.json'));
    for (const file of jobFiles) {
      try {
        const raw = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
        const parsed = JSON.parse(raw);
        const job = createJob(parsed);
        jobs.set(job.id, job);
      } catch (err) {
        // Skip unreadable or corrupted temp files
      }
    }
  }

  if (tasksDir && fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
    for (const file of taskFiles) {
      try {
        const raw = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
        const parsed = JSON.parse(raw);
        const task = createTask(parsed);
        tasks.set(task.id, task);
      } catch (err) {
        // Skip unreadable or corrupted temp files
      }
    }
  }

  if (resultsDir && fs.existsSync(resultsDir)) {
    const resultFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));
    for (const file of resultFiles) {
      try {
        const raw = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
        const record = JSON.parse(raw);
        if (record.jobId) {
          const list = jobExecutionResults.get(record.jobId) || [];
          list.push(Object.freeze(record));
          jobExecutionResults.set(record.jobId, list);
        }
      } catch (err) {
        // Skip unreadable or corrupted temp files
      }
    }
  }

  return Object.freeze({
    /**
     * Creates a new authoritative Job.
     */
    createJob({
      id,
      projectId,
      workflowId,
      tenantId = null,
      scopeReference = null,
      workspaceReference = null,
      status = JobState.PENDING,
      executionMetadata = {},
      costMetadata = {},
      approvalState = undefined,
      checkpointReference = null
    }) {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Job requires valid id`);
      }
      if (jobs.has(id)) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Job already exists with id: ${id}`);
      }

      const job = createJob({
        id: id.trim(),
        projectId,
        workflowId,
        taskIds: [],
        status,
        tenantId,
        scopeReference,
        workspaceReference,
        executionMetadata,
        costMetadata,
        approvalState,
        checkpointReference,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      jobs.set(job.id, job);
      persistJob(job);
      return job;
    },

    /**
     * Retrieves an authoritative Job by id with optional tenant verification.
     */
    getJob(id, { tenantId = null } = {}) {
      if (!id || typeof id !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] getJob requires non-empty string id`);
      }
      const job = jobs.get(id);
      if (!job) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Job not found: ${id}`);
      }
      if (tenantId !== null && job.tenantId !== null && job.tenantId !== tenantId) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Tenant mismatch for Job ${id}: expected '${job.tenantId}', caller provided '${tenantId}'`);
      }
      return job;
    },

    /**
     * Updates Job state following deterministic transition matrices.
     */
    updateJobState(id, targetState, { reason = '', tenantId = null } = {}) {
      const currentJob = this.getJob(id, { tenantId });
      
      // Idempotent no-op if state already matches
      if (currentJob.status === targetState) {
        return currentJob;
      }

      // Validates transition legality via domain rules
      validateStateTransition('JOB', currentJob.status, targetState);

      const updatedJob = createJob({
        ...currentJob,
        status: targetState,
        updatedAt: new Date().toISOString()
      });

      jobs.set(id, updatedJob);
      persistJob(updatedJob);
      return updatedJob;
    },

    /**
     * Creates a new authoritative Task linked strictly to a parent Job.
     */
    createTask({
      id,
      jobId,
      objective,
      taskType = 'DEVELOPMENT',
      agentRole = null,
      status = TaskState.PENDING,
      inputs = {},
      expectedOutputs = [],
      acceptanceCriteria = [],
      tenantId = null
    }) {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task requires valid id`);
      }
      if (tasks.has(id)) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task already exists with id: ${id}`);
      }

      // Parent Job must exist and match tenant if provided
      const parentJob = this.getJob(jobId, { tenantId });

      const task = createTask({
        id: id.trim(),
        jobId: parentJob.id,
        objective,
        taskType,
        agentRole,
        status,
        inputs,
        expectedOutputs,
        acceptanceCriteria,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      tasks.set(task.id, task);
      persistTask(task);

      // Add task to parent Job's taskIds
      const updatedTaskIds = [...parentJob.taskIds, task.id];
      const updatedJob = createJob({
        ...parentJob,
        taskIds: updatedTaskIds,
        updatedAt: new Date().toISOString()
      });
      jobs.set(parentJob.id, updatedJob);
      persistJob(updatedJob);

      return task;
    },

    /**
     * Retrieves an authoritative Task by id with optional tenant verification.
     */
    getTask(id, { tenantId = null } = {}) {
      if (!id || typeof id !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] getTask requires non-empty string id`);
      }
      const task = tasks.get(id);
      if (!task) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task not found: ${id}`);
      }

      // Verify parent job tenant if tenantId supplied
      if (tenantId !== null) {
        this.getJob(task.jobId, { tenantId });
      }

      return task;
    },

    /**
     * Updates Task state following deterministic transition matrices.
     */
    updateTaskState(id, targetState, { reason = '', tenantId = null } = {}) {
      const currentTask = this.getTask(id, { tenantId });

      // Idempotent no-op
      if (currentTask.status === targetState) {
        return currentTask;
      }

      // Validates transition legality via domain rules
      validateStateTransition('TASK', currentTask.status, targetState);

      const updatedTask = createTask({
        ...currentTask,
        status: targetState,
        updatedAt: new Date().toISOString()
      });

      tasks.set(id, updatedTask);
      persistTask(updatedTask);
      return updatedTask;
    },

    /**
     * Lists all tasks belonging strictly to a specific Job.
     */
    listJobTasks(jobId, { tenantId = null } = {}) {
      const job = this.getJob(jobId, { tenantId });
      const result = [];
      for (const taskId of job.taskIds) {
        const task = tasks.get(taskId);
        if (task) {
          result.push(task);
        }
      }
      return Object.freeze(result);
    },

    /**
     * Binds an authoritative execution plan to a specific Job.
     */
    setJobPlan(jobId, plan, { tenantId = null } = {}) {
      const job = this.getJob(jobId, { tenantId });
      if (!plan || !plan.id) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] setJobPlan requires valid plan`);
      }
      jobPlans.set(job.id, Object.freeze({ ...plan }));
      return jobPlans.get(job.id);
    },

    /**
     * Retrieves the authoritative plan bound to a specific Job.
     */
    getJobPlan(jobId, { tenantId = null } = {}) {
      const job = this.getJob(jobId, { tenantId });
      return jobPlans.get(job.id) || null;
    },

    /**
     * Records an authoritative execution result linked to a specific Job (FAZ 39 Foundation).
     */
    recordExecutionResult(jobId, {
      id = null,
      taskId,
      planId,
      outcome,
      result = null,
      timestamp = new Date().toISOString(),
      retryCount = 0
    }, { tenantId = null } = {}) {
      const job = this.getJob(jobId, { tenantId });

      if (!taskId || typeof taskId !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] recordExecutionResult requires non-empty string taskId`);
      }
      if (!planId || typeof planId !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] recordExecutionResult requires non-empty string planId`);
      }
      if (!outcome || typeof outcome !== 'string') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] recordExecutionResult requires non-empty string outcome`);
      }

      const recordId = id || `exec-res-${job.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const record = Object.freeze({
        id: recordId,
        jobId: job.id,
        tenantId: job.tenantId,
        taskId,
        planId,
        outcome,
        result: result ? (typeof result === 'object' ? Object.freeze({ ...result }) : result) : null,
        timestamp,
        retryCount: Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0
      });

      const existing = jobExecutionResults.get(job.id) || [];
      existing.push(record);
      jobExecutionResults.set(job.id, existing);
      persistExecutionResult(record);

      return record;
    },

    /**
     * Lists all execution results recorded for a specific Job (FAZ 39 Foundation).
     */
    listJobExecutionResults(jobId, { tenantId = null } = {}) {
      const job = this.getJob(jobId, { tenantId });
      const records = jobExecutionResults.get(job.id) || [];
      return Object.freeze([...records]);
    },

    /**
     * Evaluates bounded retry legality (FAZ 39 Foundation: MAX_RETRIES = 0 by default).
     */
    isRetryAllowed(jobId, currentRetries = 0, { maxRetries = 0, tenantId = null } = {}) {
      this.getJob(jobId, { tenantId });
      if (!Number.isInteger(maxRetries) || maxRetries <= 0) {
        return false;
      }
      return currentRetries < maxRetries;
    }
  });
}
