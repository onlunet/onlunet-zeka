# AUTONOMOUS AGENCY PHASE ROADMAP

**AI Development OS — ONLUNET ZEKA**  
**Document Version**: 1.0.0 (Authoritative)  
**Phase**: FAZ 38 — ARCHITECTURE-FIRST / SCOPE LOCK  
**Baseline**: FAZ 1–37 CLOSED (555 Tests Passing)  
**Strategy**: `PROGRESSIVE HARDENING` | `ZERO SPECULATIVE CODE` | `ONE NEXT PHASE ONLY`

---

## 1. Complete Future Agency Implementation Roadmap

Based on the source-level audit of the existing ONLUNET ZEKA codebase and the pattern extractions from the 10 external frameworks, the transition to a machine-orchestrated autonomous software development agency requires the following 10 sequential phases:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ FAZ 38: Task-Scoped Execution State & Authoritative Job Engine        │ ◄── [NEXT PHASE]
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 39: Agency Policy Engine & Autonomous Preflight Admission         │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 40: Agent Runtime & Bounded Autonomous Tool Loop                   │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 41: Checkpoint / Rollback / Worker Supervision Engine              │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 42: Multi-AI Provider Registry & RunSpec Adapter Abstraction       │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 43: Multi-Agent Orchestration & Dependency DAG Runner              │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 44: Autonomous Test → Diagnose → Fix Loop (Circuit Breaker)        │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 45: Episode Store, Trajectory Logging & Passive Learning Engine    │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 46: Build, Packaging & Verifiable Delivery Release Gate            │
├────────────────────────────────────────────────────────────────────────┤
│ FAZ 47: Headless Windows Service & Agency Control Center               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Technical Specifications

### FAZ 38 — Task-Scoped Execution State & Authoritative Job Engine (NEXT PHASE)
* **Problem Solved**: Currently, `src/app/server.js` maintains global closure variables (`activeWorkspace` and `authoritativeActivePlan`), allowing only one single-turn plan at a time. This prevents multi-task sequencing, job tracking, and machine-to-machine queuing.
* **Deliverables**:
  * Introduce an authoritative in-memory `JobManager` implementing the existing `createJob()` and `createTask()` contracts from `src/contracts/domain.js`.
  * Replace global server variables with task-scoped state containers: `jobs.get(jobId)` and `tasks.get(taskId)`.
  * Endpoints: `POST /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/:id/tasks`.
* **Prerequisites**: FAZ 1–37 baseline.
* **Production Dependencies Added**: **0**.

### FAZ 39 — Agency Policy Engine & Autonomous Preflight Admission
* **Problem Solved**: Preflight admission currently defaults to verifying interactive user approval flags (`approval !== false`).
* **Deliverables**:
  * Introduce declarative `AgencyPolicy` (risk thresholds, permitted file globs, max runtime, budget limits).
  * Automate preflight admission evaluation: Low-risk actions inside authorized change surfaces are granted `AdmissionDecision.ALLOWED` automatically without interactive human prompts.
* **Prerequisites**: FAZ 38.

### FAZ 40 — Agent Runtime & Bounded Autonomous Tool Loop
* **Problem Solved**: Tools currently require manual API calls (`/api/execute` or `/api/mutate`).
* **Deliverables**:
  * Implement local `AgentRuntime` executing `RunSpec` -> Tool Invocation -> `RunResult`.
  * Standardize safe local tools: `read_file`, `edit_file` (search/replace), `run_test`, `git_status`, `git_diff`.
  * Bounded tool loop: Max tool calls per task with execution timeouts.
* **Prerequisites**: FAZ 39.

### FAZ 41 — Checkpoint / Rollback / Worker Supervision Engine
* **Problem Solved**: If an agent makes syntax errors or corrupts files during autonomous loops, there is no transactional rollback.
* **Deliverables**:
  * Git worktree isolation or atomic directory snapshot before task execution.
  * Deterministic rollback mechanism restoring pre-task checkpoint on unrecoverable failure.
  * Gas Town-style process supervisor detecting hung/stalled child processes and enforcing hard timeouts.
* **Prerequisites**: FAZ 40.

### FAZ 42 — Multi-AI Provider Registry & RunSpec Adapter Abstraction
* **Problem Solved**: AI Gateway only supports one local provider adapter at a time.
* **Deliverables**:
  * Provider registry supporting pluggable adapters (Anthropic Claude, DeepSeek, OpenAI, local LLMs).
  * Dynamic model routing based on task category (e.g. Architect -> DeepSeek-R1 / Reasoning; Coder -> Claude 3.5 Sonnet; Classifier -> Local).
  * Failover provider chaining preserving task identity and authorization boundaries.
* **Prerequisites**: FAZ 41.

### FAZ 43 — Multi-Agent Orchestration & Dependency DAG Runner
* **Problem Solved**: Tasks are currently evaluated manually in isolation.
* **Deliverables**:
  * Execute full `OrchestrationPlan` DAGs topologically: `Architect -> Coder -> Tester -> Security`.
  * Automated context handoff: The verified output of predecessor tasks forms the advisory context of successor tasks.
* **Prerequisites**: FAZ 42.

### FAZ 44 — Autonomous Test → Diagnose → Fix Loop (Circuit Breaker)
* **Problem Solved**: Test failures currently require human interpretation and re-prompting.
* **Deliverables**:
  * Automated diagnostic context extraction: Parse test runner exit code, failing assertions, and diff.
  * Generate bounded fix task scoped to failing tests.
  * Circuit breaker: Maximum 5 retry attempts, budget ceiling, immediate halt on repetitive error signatures.
* **Prerequisites**: FAZ 43.

### FAZ 45 — Episode Store, Trajectory Logging & Passive Learning Engine
* **Problem Solved**: System forgets past debugging successes and failure patterns across sessions.
* **Deliverables**:
  * Record full task execution trajectories (prompt, tool sequence, error, resolution) into an `EpisodeStore`.
  * Index successful resolutions as passive markdown skill artifacts for future relevance selection.
  * Quarantined from governance: Learning engine cannot alter security policies or grant itself privileges.
* **Prerequisites**: FAZ 44.

### FAZ 46 — Build, Packaging & Verifiable Delivery Release Gate
* **Problem Solved**: Determining when a job is truly "done" is currently subjective.
* **Deliverables**:
  * Automated multi-criteria delivery gate: All unit tests pass, linter passes, zero security alerts, clean git tree.
  * Generate cryptographic delivery manifest and release bundle.
* **Prerequisites**: FAZ 45.

### FAZ 47 — Headless Windows Service & Agency Control Center
* **Problem Solved**: System currently runs only when manually started in a foreground terminal.
* **Deliverables**:
  * Standalone headless background agency service for Windows (running jobs from an incoming queue).
  * Electron/Web Control Center acting as an observation dashboard and policy administration surface.
* **Prerequisites**: FAZ 46.

---

## 3. Explicit Single Next Phase Authorization

The architecture audit proves that **FAZ 38 (Task-Scoped Execution State & Authoritative Job Engine)** is the foundational prerequisite for all subsequent autonomy layers. Without task-scoped state containers in the server, no automated queuing, multi-agent coordination, or recovery loops can function safely.

**Target for Next Phase**: **FAZ 38 ONLY**. Do not implement now. Await explicit review and approval.
