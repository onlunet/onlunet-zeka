# FAZ 40 IMPLEMENTATION PLAN

## CONTROLLED AUTONOMOUS WORK EXECUTION CONTRACT

### 1. Current Architecture & Context
- Baseline: FAZ 39.2 completed with 580 passing tests, 0 failures, 0 skipped, 0 new dependencies.
- Core Foundation: JobEngine is the single authoritative source of truth for Jobs, Tasks, Plans, and Execution History.
- Existing Authority Chain: Tenant -> Workspace -> Job -> Plan -> Task -> Execution -> Result.
- Existing Execution Foundations:
  - Core Process Execution: executeAuthorizedRequest() in src/contracts/controlled-execution.js (Phase 11 & 11.1).
  - Pipeline Runner: runApplicationPipeline() in src/app/orchestration-runner.js (Phase 13.1).
  - File Mutation: executeAuthorizedFileMutation() in src/contracts/file-mutation.js (Phase 18).
  - HTTP Boundary: /api/jobs, /api/execute, /api/mutate, /api/jobs/:id/results in src/app/server.js.

### 2. FAZ 40 Core Objective & Concept: Work Unit
- Establish the Controlled Work Execution Contract for the future AI-driven agency without implementing the autonomous loop itself.
- A Work Unit represents an explicitly authorized, deterministic execution request.
- Schema:
  - id: string
  - tenantId: string
  - workspaceRoot: string
  - jobId: string
  - taskId: string
  - planId: string
  - action: { type: COMMAND | MUTATION, command?: string, targetPath?: string, content?: string }
  - status: PENDING | ADMITTED | EXECUTING | SUCCEEDED | FAILED | DENIED
  - createdAt: string
  - startedAt?: string
  - completedAt?: string
  - executionResultId?: string
  - verificationResult?: PASS | FAIL | INCONCLUSIVE
  - error?: { code: string, message: string }

### 3. Authority & Admission Invariants
- A Work Unit cannot execute without validating through the existing authority chain:
  1. Tenant validation: Tenant exists and matches Job.
  2. Workspace validation: Workspace directory matches Plan workspace.
  3. Job validation: Job exists, not cancelled/terminal.
  4. Plan validation: Plan exists and belongs to Job.
  5. Task validation: Task belongs to Job and Plan.
  6. Action validation: Action matches Plan expected commands / expected file changes.
- Fail-closed behavior: Any missing or mismatched authority rejects execution immediately.
- Zero second authority system: Inherits existing contracts (JobEngine, evaluateExecutionPreflight, authorizeExecutionRequest).

### 4. Lifecycle & State Invariants
- Job and Task lifecycles remain strictly explicit (ValidJobTransitions, ValidTaskTransitions).
- Work Unit completion or failure DOES NOT mutate Job or Task lifecycle states.
- Work Unit status represents the individual execution attempt only.

### 5. Deterministic Execution & Verification Boundary
- Execution leverages existing controlled execution mechanisms (executeAuthorizedRequest / executeAuthorizedFileMutation).
- Verification is strictly evidence-based (ValidationResult.PASS vs FAIL).
- If verification fails, execution stops with FAILED. No auto-repair, no auto-retry loop.
- Retry foundation remains declarative (maxRetries = 0).

### 6. Minimal Implementation Scope
- Create src/contracts/work-unit.js:
  - createWorkUnit(params) factory function with freeze and schema validation.
  - admitWorkUnit({ workUnit, jobEngine }) validating full authority chain.
  - executeWorkUnit({ workUnit, jobEngine, commandRunner, activeWorkspace }) coordinating controlled execution and recording execution result via jobEngine.recordExecutionResult.
- Export work-unit.js in src/index.js.
- In src/contracts/constants.js, define minimal WorkUnit constants (WorkUnitStatus, WorkUnitActionType).
- In src/app/server.js, expose POST /api/work-units/admit and POST /api/work-units/execute.
- Create dedicated test file tests/faz40-controlled-work-unit.test.js covering all 20 required test categories.

### 7. Explicitly Out-of-Scope Items
- No AI router / provider / LLM integration.
- No multi-agent orchestration.
- No auto-repair / auto-healing loop.
- No background queues (BullMQ/Redis) or worker pools.
- No schedulers, cron jobs, or daemons.
- Zero new npm dependencies.

### 8. Verification Strategy
- Run baseline npm test before and after each modification.
- Verify FAZ 38, FAZ 39, and FAZ 40 independently.
- Conduct comprehensive forensic audit.