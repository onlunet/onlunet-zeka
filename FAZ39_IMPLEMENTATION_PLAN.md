# FAZ 39 IMPLEMENTATION PLAN

## CONTROLLED AUTONOMOUS EXECUTION FOUNDATION

### 1. Current Architecture & Context
- **Baseline**: FAZ 38.2 Job-scoped execution & mutation authority is active and verified across 570 passing tests.
- **Authority Root**: JobEngine is the single authoritative source of truth for Jobs, Tasks, and Plans (JobEngine.getJobPlan(jobId)).
- **HTTP Boundary**: createApplicationServer exposes endpoints:
  - /api/workspace (workspace selection & validation)
  - /api/plan (AI gateway plan proposal -> authoritative plan bound into JobEngine)
  - /api/jobs, /api/jobs/:id, /api/jobs/:id/state, /api/jobs/:id/tasks
  - /api/tasks/:id, /api/tasks/:id/state
  - /api/execute (controlled command pipeline runner)
  - /api/mutate (controlled file mutation pipeline runner)

### 2. Existing Authority Chain
`
Tenant
  ↓
Workspace
  ↓
Job
  ↓
Task
  ↓
Authoritative Plan
  ↓
Execution / Mutation
  ↓
Result
`
No lower-level entity may bypass a higher-level authority. command, planId, 	askId, jobId, and 	enantId must be strictly validated together.

### 3. Existing Execution Flow & Gap Analysis
- Currently, when /api/execute or /api/mutate runs:
  1. The server resolves the authoritative plan from JobEngine.getJobPlan(jobId) (with tenant verification).
  2. The server verifies identity matches (planId, 	askId, workspaceRoot).
  3. The pipeline runner executes the command or mutates the file.
  4. The execution result is returned to the HTTP client, but **is not formally recorded/persisted on the Job/Task in JobEngine**.
  5. Job lifecycle status transitions remain explicitly managed via POST /api/jobs/:id/state according to ValidJobTransitions.
- **FAZ 39 Scope**:
  1. Add execution result association on JobEngine (storing execution records linked to jobId, taskId, planId, outcome, result, timestamp).
  2. Optional bounded retry foundation (MAX_RETRIES = 0 default, no automatic loops).
  3. Expose result queries in JobEngine and via HTTP (GET /api/jobs/:id/results).
  4. Record execution results in /api/execute and /api/mutate deterministically into JobEngine.
  5. Preserve explicit Job lifecycle management: Execution and mutation endpoints record authoritative execution results, while Job lifecycle state remains explicitly controlled through the existing Job state transition API and ValidJobTransitions contract. Execution result persistence and Job lifecycle state are intentionally separate concerns.

### 4. Required Minimal Changes
- In src/contracts/job-engine.js:
  - Add internal collection jobExecutionResults = new Map() (or store array per jobId).
  - Add ecordExecutionResult(jobId, { taskId, planId, outcome, result, timestamp, retryCount = 0 }, { tenantId = null }).
  - Add listJobExecutionResults(jobId, { tenantId = null }).
  - If storageDir is configured, persist execution results atomically (esults/<jobId>-<timestamp>.json or in job metadata).
  - Add optional bounded retry configuration / check helper (isRetryAllowed(jobId, currentRetries, { maxRetries = 0 })), strictly defaulting to 0 retries.
- In src/app/server.js:
  - In /api/execute: when ody.jobId is provided, record the execution result via uthoritativeEngine.recordExecutionResult(...). Job lifecycle state transitions remain explicit and separate.
  - In /api/mutate: when ody.jobId is provided, record mutation result via uthoritativeEngine.recordExecutionResult(...).
  - Add GET /api/jobs/:id/results endpoint (with tenant check).
- In 	ests/faz39-controlled-execution.test.js:
  - Implement all 10 required security and isolation tests:
    - Test 1: Job A -> Plan A -> Execute A -> PASS, result recorded.
    - Test 2: Job B -> Plan B -> Execute B -> PASS, result recorded.
    - Test 3: Job A + Plan B -> FAIL CLOSED.
    - Test 4: Job B + Plan A -> FAIL CLOSED.
    - Test 5: Job without plan -> FAIL CLOSED.
    - Test 6: Cross-tenant execution -> SECURITY_BLOCKED.
    - Test 7: Cross-tenant mutation -> SECURITY_BLOCKED.
    - Test 8: Legacy global plan + Job execution -> FAIL CLOSED.
    - Test 9: Plan replacement on Job A does not affect Job B.
    - Test 10: Execution result on Job A does not affect Job B's state or results.
  - Concurrency tests: Concurrent execution of Jobs A, B, C preserves isolation.
  - Bounded retry foundation test: MAX_RETRIES = 0 default blocks retries fail-closed.

### 5. Files to Modify
- src/contracts/job-engine.js (add execution result storage & retrieval, bounded retry constant/helper)
- src/app/server.js (record execution result to JobEngine, add /api/jobs/:id/results)

### 6. Files to Create
- 	ests/faz39-controlled-execution.test.js
- FAZ39_IMPLEMENTATION_PLAN.md (this file)
- FAZ39_IMPLEMENTATION_REPORT.md (after verification)

### 7. Explicitly Out-of-Scope Items
- No AI router / AI provider selector
- No multi-agent orchestration
- No autonomous repair / fix loops
- No self-healing
- No automatic approval bypass
- No automatic rollback engine
- No worker pools / process pools
- No queue systems (Redis/Bull/BullMQ)
- No schedulers / cron
- No cloud/remote execution
- No new external npm dependencies

### 8. Security Invariants
- Fail-closed execution on any mismatch (SECURITY_BLOCKED / INVALID_CONTRACT).
- Zero global mutable authority (uthoritativeActivePlan, currentJob, currentPlan strictly forbidden).
- Tenant isolation enforced on all result records and queries.

### 9. Test Plan
- Run 
ode --test to ensure all 570 baseline tests pass.
- Run 
ode --test tests/faz39-controlled-execution.test.js verifying Tests 1-10 and concurrency.
- Run full suite to confirm 100% pass with zero regression.
