# MASTER AUTONOMOUS AGENCY ARCHITECTURE

**AI Development OS — ONLUNET ZEKA**  
**Document Version**: 1.0.0 (Authoritative)  
**Phase**: FAZ 38 — ARCHITECTURE-FIRST / SCOPE LOCK  
**Baseline**: FAZ 1–37 CLOSED & VERIFIED (555/555 Regression Tests Passing)  
**Authority Invariant**: `AUTONOMY != AUTHORITY` | `HUMAN COPY/PASTE FORBIDDEN WHERE M2M PATH EXISTS`

---

## 1. Current Architecture (FAZ 1–37 Baseline)

The current production codebase in `src/` represents a hardened, deterministic, single-turn human-supervised foundation:

```text
                               CURRENT PRODUCTION PIPELINE (FAZ 1-37)
                               
   USER REQUEST (HTTP POST /api/plan)
        │
        ▼
   TASK NORMALIZATION & INTENT CLASSIFICATION (task-understanding.js)
        │  Tokens extracted, broad category (INSPECT, MODIFY, TEST, etc.)
        ▼
   DETERMINISTIC RELEVANCE SELECTION & ADVISORY CONTEXT (workspace.js + task-understanding.js)
        │  Scans discovered files, bounded read (max 100KB, max 10 files), isAuthoritative: false
        ▼
   AI GATEWAY / LOCAL PROVIDER ADAPTER (ai-gateway.js)
        │  Generates declarative proposal: { intent, analysis, proposedCommands, proposedFileChanges }
        ▼
   AUTHORITATIVE EXECUTION PLAN (server.js holds authoritativeActivePlan in closure memory)
        │  Assigned unique planId and taskId, immutable expectedCommands and expectedFileChanges
        ▼
   MANUAL HUMAN APPROVAL / DISPATCH (User copies plan or clicks UI execute/mutate)
        │
   ┌────┴────────────────────────────────────────┐
   ▼                                             ▼
HTTP POST /api/execute                        HTTP POST /api/mutate
   │ (command, planId, approval)                 │ (targetPath, content, planId, approval)
   ▼                                             ▼
Preflight Admission Gate (preflight.js)       Preflight Admission Gate (server.js inline policies)
   │ Checks TaskState != TERMINAL                │ Checks targetPath in expectedFileChanges
   │ Checks Scope, Exec, Sec, Appr policies      │ Checks path inside activeWorkspace
   ▼                                             ▼
Execution Handoff & Authorization             Authorization Contract & Target Binding
   │ Exact context binding                       │ workingDirectory & authorizedTarget bound
   ▼                                             ▼
Controlled Process Execution                  Controlled File Mutation
   │ spawnSync(shell: false) in                  │ fs.writeFileSync in file-mutation.js
   │ controlled-execution.js                     │ Atomic single-file write
   ▼                                             ▼
Declarative Result & Post-Validation          File Mutation Result Contract
   │ Exit code, stdout, stderr, Evidence         │ Outcome: SUCCEEDED / FAILED
   ▼                                             ▼
Validation Result (PASS / FAIL)               Validation Result (PASS / FAIL)
```

### Existing Authoritative Modules
* **Domain & Contract Factory**: `src/contracts/domain.js` (`Project`, `Job`, `Task`, `Workflow`, `Blueprint`, `ChangeIntent`, `Approval`, `Evidence`, `Validation`).
* **Constants & State Machines**: `src/contracts/constants.js` (`ProjectState`, `JobState`, `TaskState`, `AgentRoles`, `ErrorCodes`).
* **Descriptive Orchestration**: `src/contracts/orchestration.js` (`createOrchestrationPlan`, `resolveExecutionOrder`).
* **Preflight Eligibility & Admission**: `src/contracts/orchestrator.js` & `src/contracts/preflight.js` (`evaluateExecutionPreflight`, `evaluateTaskExecutionEligibility`).
* **Execution Authorization**: `src/contracts/execution-authorization.js` (`createExecutionAuthorizationContract`, `authorizeExecutionRequest`).
* **Controlled Execution**: `src/contracts/controlled-execution.js` (`executeAuthorizedRequest` via `spawnSync`, `shell: false`).
* **Controlled File Mutation**: `src/contracts/file-mutation.js` (`executeAuthorizedFileMutation` via `fs.writeFileSync`).
* **Policy Engines**: `src/policies/policies.js` (`ScopePolicy`, `ExecutionPolicy`, `SecurityPolicy`, `ApprovalPolicy`).
* **Containment & Boundaries**: `src/interfaces/core.js` (`isPathInsideDirectory`, Windows-safe case-insensitive canonicalization).
* **Application Server & Workspace**: `src/app/server.js`, `src/app/workspace.js`, `src/app/ai-gateway.js`, `src/app/task-understanding.js`, `src/app/orchestration-runner.js`.

---

## 2. Target Architecture (Machine-Orchestrated Autonomous Software Development)

The target architecture replaces human prompt-copying, output-copying, and manual handoffs with a fully automated, machine-to-machine loop governed by deterministic policy:

```text
                                 TARGET AUTONOMOUS AGENCY ARCHITECTURE
                                 
                                     ┌─────────────────────────┐
                                     │       USER REQUEST      │
                                     │  "Fix bug X in Repo Y"  │
                                     └────────────┬────────────┘
                                                  │ Machine Ingestion
                                                  ▼
   LAYER A: AGENCY GOVERNANCE        ┌─────────────────────────┐
   (Deterministic Authority Core)    │       JOB MANAGER       │ ◄── Creates Authoritative Job Record
                                     └────────────┬────────────┘
                                                  │
                                                  ▼
                                     ┌─────────────────────────┐
                                     │      AGENCY POLICY      │ ◄── Verifies Scope, Budget, Approval Mode
                                     │     ADMISSION GATE      │     (Auto-admit safe vs Require human)
                                     └────────────┬────────────┘
                                                  │
                                                  ▼
   LAYER B: ORCHESTRATOR             ┌─────────────────────────┐
   (Task Graph & Supervision)        │     ORCHESTRATOR /      │ ◄── Generates DAG of Tasks
                                     │    TASK GRAPH ENGINE    │     (Plan -> Code -> Test -> Validate)
                                     └────────────┬────────────┘
                                                  │
                         ┌────────────────────────┼────────────────────────┐
                         │                        │                        │
                         ▼                        ▼                        ▼
   LAYER C: AI ROUTER    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   (Model Selection &    │   PLANNER    │  │    CODER     │  │   TESTER/    │
   Adapter Mediation)    │  (DeepSeek)  │  │   (Claude)   │  │   SECURITY   │
                         └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                                └─────────────────┼─────────────────┘
                                                  │ Structured Proposal
                                                  ▼
   AUTHORITATIVE PLAN            ┌─────────────────────────────────────────┐
                                 │       AUTHORITATIVE EXECUTION PLAN      │ ◄── Exact commands & files bound
                                 └────────────────┬────────────────────────┘
                                                  │
                                                  ▼
   LAYER E: WORKSPACE            ┌─────────────────────────────────────────┐
   (Isolation & Checkpoints)     │     ISOLATED WORKSPACE / CHECKPOINT     │ ◄── Git Worktree / Pre-task snapshot
                                 └────────────────┬────────────────────────┘
                                                  │
                                                  ▼
   LAYER D: AGENT RUNTIME        ┌─────────────────────────────────────────┐
   (Bounded Local Execution)     │       SUPERVISED AGENT RUNTIME          │
                                 │   Tool Execution: Shell, Edit, Test     │
                                 └────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                                 ┌─────────────────────────────────────────┐
                                 │     MACHINE OBSERVATION & EVIDENCE      │
                                 └────────────────┬────────────────────────┘
                                                  │
                                                  ▼
   LAYER F: VALIDATION           ┌─────────────────────────────────────────┐
   (Objective Verification)      │       OBJECTIVE VALIDATION GATE         │
                                 │     (npm test, build, lint, diff)       │
                                 └────────┬───────────────────────┬────────┘
                                          │                       │
                                   FAIL (Exit != 0)         PASS (Exit == 0)
                                          │                       │
                                          ▼                       ▼
                                 ┌─────────────────┐     ┌─────────────────┐
                                 │ DIAGNOSE & FIX  │     │ SECURITY REVIEW │
                                 │ (Bounded Retry) │     └────────┬────────┘
                                 └────────┬────────┘              │
                                          │ Loops back            ▼
                                          └──────────►   ┌─────────────────┐
                                                         │  RELEASE GATE   │
                                                         └────────┬────────┘
                                                                  │
                                                                  ▼
   LAYER G: LEARNING                                     ┌─────────────────┐
   (Passive Trajectory Capture)                          │  EPISODE STORE  │
                                                         └─────────────────┘
```

---

## 3. Strict Layer Boundaries

| Layer | Name | Primary Responsibility | Owns Authority? | Can Mutate Code? |
| :--- | :--- | :--- | :--- | :--- |
| **Layer A** | **Agency Governance** | Identity, scope, tenant isolation, budget policy, admission decisions, release approval gates. | **YES (Sole Authority)** | NO |
| **Layer B** | **Orchestrator** | Job decomposition, task graph sequencing, dependency resolution, failure routing, worker supervision. | NO (Evaluates rules) | NO |
| **Layer C** | **AI Router / Models** | Prompt specialized models (Planner, Coder, Reviewer, Security), translate to normalized schema. | NO (Advisory Only) | NO |
| **Layer D** | **Agent Runtime** | Bounded command/edit execution within authorized plan bounds. | NO (Executes tools) | **YES (Through Plan)** |
| **Layer E** | **Workspace Manager** | Worktree isolation, clean directory containment, checkpoint snapshots, rollback recovery. | NO (Infrastructure) | Only on Rollback |
| **Layer F** | **Validation** | Objective testing, linting, security scanning, artifact hash verification. | **YES (Validation Result)** | NO |
| **Layer G** | **Learning Engine** | Capturing trajectory logs, failure pattern indexes, post-job evaluation. Non-authoritative context. | NO (Passive Store) | NO |

---

## 4. Unidirectional Authority & Data Flow

```text
[User Request] 
      │
      ▼
[Job Manager] ────► Asserts Tenant & Project Identity
      │
      ▼
[Agency Policy] ──► Checks Budget & Scope Limits ──► [Decision: ALLOWED / DENIED]
      │
      ▼
[Task Graph] ─────► Topological Ordering of Tasks (TaskState: READY)
      │
      ▼
[AI Router] ──────► Invokes Model Adapter ──► [Advisory Proposal]
      │
      ▼
[Plan Evaluator] ─► Freezes Authoritative Execution Plan
      │
      ▼
[Admission Gate] ─► Evaluates Policies & Approval Rules ──► [Admission: ALLOWED]
      │
      ▼
[Authorization] ──► Binds workingDirectory & expectedCommands / Target
      │
      ▼
[Agent Runtime] ──► Executes Authorized Command / Mutation in Worktree
      │
      ▼
[Evidence Collation] ──► Captures Process Output & Diffs
      │
      ▼
[Validation Gate] ────► Evaluates Objective Acceptance Criteria (PASS / FAIL)
```

---

## 5. Lifecycles

### 5.1 Job Lifecycle
```text
JobState: PENDING 
    ──► READY (Scope & Policy validated)
    ──► RUNNING (Tasks actively executing)
    ──► APPROVAL_REQUIRED (Escalation policy tripped or high-risk task)
    ──► VALIDATING (All tasks completed, final suite executing)
    ──► COMPLETED (All validations passed, artifacts verified)
    ──► FAILED (Exhausted retries, circuit breaker tripped, or security blocked)
    ──► CANCELLED (Aborted by user or budget limit)
```

### 5.2 Task Lifecycle
```text
TaskState: PENDING 
    ──► READY (Predecessor tasks satisfied)
    ──► RUNNING (Dispatched to worker runtime)
    ──► VALIDATING (Process/mutation executed, verifying evidence)
    ──► COMPLETED (Acceptance criteria strictly evaluated as PASS)
    ──► BLOCKED (Missing policy admission or dependency failure)
    ──► FAILED (Execution failed and retries exhausted)
```

### 5.3 Agent Lifecycle
```text
Agent: UNINSTANTIATED 
    ──► INITIALIZED (Assigned Role, allowed tools, and workspace root)
    ──► INSTRUCTED (Receives machine-generated RunSpec contract)
    ──► EXECUTING (Running tool calls under strict plan boundaries)
    ──► REPORTING (Emits structured RunResult with evidence references)
    ──► TERMINATED (Process cleanly exited, runtime resources reclaimed)
```

### 5.4 Workspace Lifecycle
```text
Workspace: UNINITIALIZED 
    ──► INITIALIZED (Workspace root verified, path containment active)
    ──► SNAPSHOTTED (Checkpoint created prior to task execution)
    ──► MUTATED (Authorized single-file mutations applied)
    ──► VERIFIED (Validation passes) ──► MERGED
    ──► ROLLED_BACK (Validation fails / error occurs) ──► CLEAN
```

### 5.5 Failure Lifecycle (Autonomous Test → Diagnose → Fix Loop)
```text
Validation FAIL (Exit code != 0)
    │
    ▼
Failure Classifier (Determines failure category: SYNTAX, TEST_ASSERTION, TIMEOUT, MISSING_DEPENDENCY)
    │
    ▼
Circuit Breaker Check (iterationCount < MAX_RETRIES && cost < BUDGET_LIMIT)
    ├──► Limit Exceeded: Mark Task FAILED ──► Escalate to Human / Job FAILED
    └──► Limit OK:
           │
           ▼
     Diagnostic Context Generation (Extract stderr, failing test name, git diff)
           │
           ▼
     Fix Task Dispatch (Scoped strictly to fixing failing test target)
           │
           ▼
     New Execution Plan & Admission Gate ──► Re-execute ──► Retest
```

---

## 6. Machine-to-Machine Ingestion & Dispatch Contracts

To eliminate human copy/paste, the system introduces two fundamental machine contracts (derived from architectural analysis of production harnesses):

### `RunSpec` (Machine-to-Machine Instruction)
```javascript
{
  jobId: "job-101",
  taskId: "task-202",
  agentRole: "Developer",
  providerId: "anthropic-claude-3-5",
  workingDirectory: "D:/Antigravity/ONLUNET ZEKA",
  instructions: "Fix null pointer in src/app/server.js line 42",
  advisoryContext: {
    relevantFiles: ["src/app/server.js"],
    fileContents: [{ path: "src/app/server.js", content: "..." }],
    diagnosticLogs: "TypeError: Cannot read properties of null (reading 'taskId')"
  },
  timeoutMs: 60000,
  toolPolicy: {
    allowedTools: ["read_file", "edit_file", "run_test"]
  },
  iterationBudget: {
    maxAttempts: 3,
    currentAttempt: 1
  }
}
```

### `RunResult` (Machine-to-Machine Structured Observation)
```javascript
{
  jobId: "job-101",
  taskId: "task-202",
  status: "COMPLETED", // "COMPLETED" | "FAILED" | "TIMEOUT" | "SECURITY_BLOCKED"
  exitCode: 0,
  durationMs: 4210,
  tokenUsage: { input: 1250, output: 340, costEstimateUsd: 0.008 },
  mutationsApplied: ["src/app/server.js"],
  commandExecuted: "npm test",
  evidenceReferences: ["ev-9821"],
  failureReason: null,
  checkpointId: "chk-pre-task-202"
}
```

---

## 7. Windows-First & Headless Operation Architecture

* **Process Management**: Native `node:child_process` (`spawnSync` / `spawn`) with explicit Windows argument escaping and `windowsHide: true`.
* **Path Canonicalization**: `normalizePathForComparison()` in `interfaces/core.js` strictly handles Windows drive letter case-insensitivity, backslashes, and UNC roots.
* **Service Architecture**: Node.js background agency service running as a Windows Service or background process; zero dependency on active interactive desktop sessions.
* **Electron / Antigravity Position**: Client UI connects over local authenticated IPC/HTTP purely as an **observation and configuration console**; execution occurs autonomously in the headless service.

---

## 8. Anti-Infinite Loop Invariants & Limits

```text
MAX_TASK_RETRIES        = 5 attempts
MAX_JOB_RUNTIME_SECONDS = 1800 seconds (30 minutes)
MAX_JOB_COST_USD        = $5.00
MAX_PARALLEL_WORKERS    = 2 concurrent processes
CIRCUIT_BREAKER_TRIP    = 3 identical consecutive error signatures
```
Budget exhaustion or circuit breaker activation **fails closed**, immediately halts worker processes, restores the last known good checkpoint, and notifies the job owner.
