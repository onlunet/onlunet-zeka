# EXTERNAL AGENT FRAMEWORK ARCHITECTURAL EXTRACTION

**AI Development OS — ONLUNET ZEKA**  
**Document Version**: 1.0.0 (Authoritative)  
**Phase**: FAZ 38 — ARCHITECTURE-FIRST / SCOPE LOCK  
**Audited Projects**: 10 External Production/Research Frameworks  
**Guiding Invariant**: `EXTRACT PATTERN -> COMPARE WITH ONLUNET ZEKA -> ADAPT/REIMPLEMENT UNDER EXISTING GOVERNANCE -> ZERO DEPENDENCY LOCK-IN`

---

## 1. Comparative Executive Decision Matrix

| Project | Primary Pattern | ONLUNET ZEKA Equivalent | Decision | Architectural Reason | Primary Risk if Directly Ingested |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. DeepSeek Harness** | Autonomous Agent Evaluation & Tool-Loop Harness | `orchestration-runner.js` + `controlled-execution.js` | **ADAPT** | Clean decoupling of agent run loop (`RunSpec` -> Tool Call -> `RunResult`). Adapting execution isolation semantics to Windows Node.js. | Heavy Python/Docker orientation; would bypass our preflight admission gates if ingested as dependency. |
| **2. OpenHands** | Client-Server Agent Workspace Architecture | `server.js` + `workspace.js` | **ADAPT** | Client/Server separation via event streams and sandboxed workspace. Adapting event model to our HTTP/IPC server. | Monolithic multi-container complexity; introduces external auth & container overhead. |
| **3. SWE-agent** | Terminal/File Editing Coding Agent Loop | `file-mutation.js` + `task-understanding.js` | **REIMPLEMENT** | High-precision bounded file editing (Aider-style unified diff / search-replace) and linters inside tool loop. | Relies on interactive bash subshell hooks and Python runtime. |
| **4. Aider** | Git RepoMap, Unified Diffs, Commit Discipline | `task-understanding.js` (Relevance) + `file-mutation.js` | **ADAPT** | RepoMap AST ranking and strict Git commit-per-task discipline. We already have deterministic candidate selection; adding Git diff tracking. | Heavy Python dependency stack (`tree-sitter`, `gitpython`); must implement cleanly in native Node.js. |
| **5. LangGraph** | State Machine DAG & Checkpointing | `domain.js` (`JobState`, `TaskState`) + `orchestration.js` | **REIMPLEMENT** | Declarative cyclic state graph with checkpoint/resume tokens. Our domain already has frozen state machines; we will add native checkpoint nodes. | Heavy Python/LangChain framework bloat; duplicates existing contract state authority. |
| **6. CrewAI** | Multi-Role Agent Team Collaboration | `constants.js` (`AgentRoles`) + `orchestration.js` | **ADAPT** | Clear agent role specializations (Planner, Coder, Reviewer). Our system already defines `AgentRoles`; we adapt the handoff schema. | Agentic self-delegation loops can cause runaway token spend; creates duplicate workflow authority. |
| **7. Microsoft Agent Framework** | Enterprise Policy-Gated Workflows | `policies/policies.js` + `preflight.js` | **ADAPT** | Policy interceptors and pre/post-invocation guardrails. Perfectly aligns with our existing `AdmissionDecision` architecture. | Cloud enterprise vendor lock-in (Azure SDKs); must remain local Windows-first. |
| **8. Gas Town** | Worker Supervision & Stalled Agent Recovery | *Missing Capability* (Recommended for FAZ 41) | **REIMPLEMENT** | Heartbeat monitoring, stalled worker detection, automatic SIGKILL and checkpoint recovery. | Built for Linux/Go daemon architectures; needs native Windows process monitoring. |
| **9. CL-Agent** | Continual Learning & Trajectory Distillation | *Missing Capability* (Recommended for FAZ 45) | **REIMPLEMENT** | Capturing trajectories (Prompt -> Tool -> Error -> Fix) as passive non-authoritative skill artifacts for future context. | Complex reinforcement/vector DB dependencies; must remain passive markdown/JSON evidence artifacts. |
| **10. twaldin/harness** | Normalized Agent Adapter Schema | `ai-gateway.js` (`createProviderAdapterInterface`) | **ADAPT** | Clean separation of agent execution spec (`RunSpec`) from execution outcome (`RunResult`). Adapting to standard Node.js interface. | Specific CLI wrapping assumptions; needs strict integration with our cryptographic task identity. |

---

## 2. Deep-Dive Extraction by Framework

### 2.1 DeepSeek Harness
* **Source-Level Findings**: Designed as a benchmark and execution harness for DeepSeek-Coder. Contains strict loop: `ProblemStatement -> Agent Prompt -> Shell/Code Tool Execution -> Unit Test Execution -> Evaluation Verdict`.
* **Execution Flow**: A runner initiates a runner container, mounts the repo under test, injects problem instructions, executes agent loops until either tests pass or max token/iteration budget is reached.
* **Useful Patterns**:
  * Clean separation of test harness from agent code.
  * Hard iteration limits preventing runaway generation.
  * Capturing stdout/stderr/patch as atomic execution evidence.
* **Rejected Patterns**: Direct execution without intermediate policy checks; assumes agent prompt can run arbitrary shell commands inside Docker.
* **Adoption Decision**: **ADAPT**. We adopt the test-diagnose-fix loop structure and iteration budget limits, but enforce our preflight admission gate before every command execution.

### 2.2 OpenHands (formerly OpenDevin)
* **Source-Level Findings**: Comprehensive client-server autonomous software development system. Utilizes an EventStream architecture where UI, Agents, and Runtimes communicate via typed events (`Action` and `Observation`).
* **Execution Flow**: Server receives task -> initializes state machine -> agent emits `Action` (e.g. `FileEditAction`, `CmdRunAction`) -> runtime executes inside container -> emits `Observation` (e.g. `CmdOutputObservation`) -> agent digests observation.
* **Useful Patterns**:
  * Event-driven architecture where every action and observation is an immutable typed object.
  * Clean separation between Agent Thought, Agent Action, and System Observation.
* **Rejected Patterns**: Heavy multi-container deployment requirement; agent holds execution state in memory without strict external policy gating.
* **Adoption Decision**: **ADAPT**. We adopt the typed `Action` -> `Observation` event model for headless logging and telemetry, but execute actions through our native Windows `executeAuthorizedRequest` and `executeAuthorizedFileMutation`.

### 2.3 SWE-agent (Princeton NLP)
* **Source-Level Findings**: Tailored coding agent using an "Agent-Computer Interface" (ACI) designed specifically for repository navigation, file inspection, and targeted patching.
* **Execution Flow**: Uses custom terminal commands (`open_file`, `scroll_down`, `edit_line`, `submit`) with concise output designed to prevent context window pollution.
* **Useful Patterns**:
  * Search/replace block edits rather than full file rewrites (similar to our FAZ 16 `FileMutationOperation.WRITE`).
  * Syntax checking and linter runs immediately following an edit action.
  * Concise command responses (avoiding dumping 5000 lines into LLM context).
* **Rejected Patterns**: Custom interactive shell statefulness (which causes hangs on Windows commands like `cmd.exe` or `powershell.exe`).
* **Adoption Decision**: **REIMPLEMENT**. We reimplement search-replace line editing and immediate syntax verification natively in Node.js, avoiding interactive subshell statefulness.

### 2.4 Aider
* **Source-Level Findings**: Leading terminal-based pair programming tool. Renowned for its `RepoMap` (tree-sitter AST ranking of repo symbols) and disciplined Git commit automation.
* **Execution Flow**: Prompt -> analyze RepoMap -> select minimal file set -> generate unified/diff edit -> apply edit -> run linter/test -> on pass: auto-commit with descriptive message; on fail: prompt model with test output to auto-fix.
* **Useful Patterns**:
  * Automatic Git commits per verified task.
  * Rolling back dirty changes immediately if tests fail and cannot be fixed.
  * Strict context reduction: Only sending AST summaries for peripheral files and full text only for targeted files.
* **Rejected Patterns**: Directly executing git commands and modifying user files without an explicit approval or preflight contract.
* **Adoption Decision**: **ADAPT**. We adapt the Git commit discipline (every validated task produces an atomic commit) and RepoMap-style symbol ranking into our deterministic relevance selector, while preserving our `FileMutation` boundary.

### 2.5 LangGraph
* **Source-Level Findings**: Graph-based state machine framework where agents and tools are nodes, and state transitions are edges. Supports cycles, conditional branching, and time-travel checkpointing.
* **Execution Flow**: State object passes through nodes -> conditional edge evaluates state -> routes to next agent node or tool node -> checkpoint saved after every node.
* **Useful Patterns**:
  * Deterministic cyclic graphs (`Plan -> Act -> Test -> (Fail -> Plan / Pass -> End)`).
  * State persistence and time-travel rollback to any previous node.
* **Rejected Patterns**: LangChain dependency bloat, high abstraction overhead, Python-centric typing.
* **Adoption Decision**: **REIMPLEMENT**. We already have frozen state machines (`ProjectState`, `JobState`, `TaskState`). We will implement our own lightweight, deterministic DAG runner with checkpointing in pure Node.js (FAZ 40).

### 2.6 CrewAI
* **Source-Level Findings**: Multi-agent framework organizing agents into "Crews" with explicit roles, goals, backstories, and hierarchical or sequential task assignments.
* **Execution Flow**: Crew definition -> task assignment to specific Agent Role -> Agent delegates or executes tools -> Manager agent aggregates outputs.
* **Useful Patterns**:
  * Clear specialization: An Architect agent doesn't write code; a Coder doesn't approve security.
  * Hierarchical review: Output of Coder is explicitly routed to Reviewer.
* **Rejected Patterns**: Autonomous inter-agent delegation loops where agents spawn sub-tasks without budget controls.
* **Adoption Decision**: **ADAPT**. We adapt the specialized role definitions (`AgentRoles.ARCHITECT`, `AgentRoles.DEVELOPER`, `AgentRoles.SECURITY`, `AgentRoles.QA`) to define prompt personas, but enforce strict topological ordering via `OrchestrationPlan` rather than dynamic runaway delegation.

### 2.7 Microsoft Agent Framework (Semantic Kernel / AutoGen)
* **Source-Level Findings**: Enterprise agent orchestration with focus on policy filters, audit hooks, and enterprise guardrails.
* **Execution Flow**: Invocation -> Pre-Invocation Filter (Validates auth/budget) -> Agent Execution -> Post-Invocation Filter (Redacts secrets, evaluates output) -> Audit Ledger.
* **Useful Patterns**:
  * Pre-invocation and post-invocation policy filters.
  * Strict enterprise audit logging of every tool invocation.
* **Rejected Patterns**: Complex Azure cloud dependencies and C#/.NET idiomatic overhead.
* **Adoption Decision**: **ADAPT**. This directly mirrors our `evaluateExecutionPreflight` (pre-invocation) and `evaluatePostExecutionValidation` (post-invocation). We formalize this pattern as our universal policy interceptor.

### 2.8 Gas Town
* **Source-Level Findings**: Robust agent process supervisor designed to manage long-running coding workers. Monitors heartbeats, detects stalled worker processes, and handles graceful worker crashes.
* **Execution Flow**: Supervisor spawns worker -> pings heartbeat -> if worker dead/hung past timeout: SIGKILL -> roll back workspace to last checkpoint -> respawn or fail.
* **Useful Patterns**:
  * Defensive supervision: Never trust an autonomous process not to deadlock or freeze.
  * Hard wall-clock timeout killing.
  * Clean process group cleanup on Windows (`taskkill /F /T`).
* **Rejected Patterns**: Linux-specific process daemon management.
* **Adoption Decision**: **REIMPLEMENT**. We implement a native Windows process supervisor in Node.js using `child_process` process trees and explicit timeouts for all autonomous executions.

### 2.9 CL-Agent
* **Source-Level Findings**: Research architecture for Continual Learning in LLM agents. Records trajectories (task prompt, reasoning steps, tool calls, error traces, final success) into an episodic memory store.
* **Execution Flow**: Execution completes -> Trajectory Evaluator scores performance -> successful patterns distilled into "Skill / Knowledge Artifacts" -> indexed for retrieval in future similar tasks.
* **Useful Patterns**:
  * Offline skill extraction: Learning occurs *after* execution, not *during* critical path.
  * Passive evidence artifacts: Knowledge is stored as transparent, readable documentation, not opaque model weight changes.
* **Rejected Patterns**: Letting learned skills automatically modify system governance or security policies.
* **Adoption Decision**: **REIMPLEMENT**. We implement an `EpisodeStore` (FAZ 45) that records validated task trajectories as passive markdown/JSON reference artifacts, strictly quarantined from governance authority.

### 2.10 twaldin/harness
* **Source-Level Findings**: Lightweight, highly normalized coding agent runner. Normalizes all coding agent interactions into a clean `RunSpec` (inputs, constraints, tools) and `RunResult` (exit code, output, diff, cost).
* **Execution Flow**: Orchestrator prepares `RunSpec` -> passes to agent runner adapter -> adapter translates to model prompt / CLI call -> runner collects output -> packages into `RunResult`.
* **Useful Patterns**:
  * Extreme simplicity and normalization: Any AI model or coding agent can be plugged in behind this single boundary.
  * Decouples the orchestrator from the provider API.
* **Rejected Patterns**: None. This is an exemplary architectural pattern.
* **Adoption Decision**: **ADAPT**. We adopt the `RunSpec` and `RunResult` contracts as the official machine-to-machine boundary between our Orchestrator (Layer B) and Agent Runtime (Layer D).

---

## 3. Duplicate Authority Audit & Anti-Frankenstein Rule

Every external framework was audited for potential duplicate authority risks:

| External Component | Potential Duplicate Authority | ONLUNET ZEKA Authoritative Gate | Audit Resolution |
| :--- | :--- | :--- | :--- |
| OpenHands Agent Policies | Internal sandbox permission system | `src/policies/policies.js` (`ScopePolicy`, `ExecutionPolicy`) | **REJECT OpenHands policy engine**. Use our existing policies. |
| LangGraph State Graphs | Custom graph execution engine | `src/contracts/domain.js` & `orchestrator.js` | **REJECT LangChain runtime**. Build lightweight native DAG runner. |
| CrewAI Delegations | Autonomous sub-task spawning | `src/contracts/orchestration.js` | **REJECT autonomous delegation**. OrchestrationPlan defines exact tasks. |
| Semantic Kernel Filters | Enterprise filter pipeline | `src/contracts/preflight.js` (`AdmissionResult`) | **REJECT external SDK**. Map directly to existing preflight. |
| AutoGen Multi-Agent Chat | Free-form peer-to-peer agent talk | `src/contracts/orchestration-runner.js` | **REJECT conversational sprawl**. Use structured `RunSpec`/`RunResult`. |

**Conclusion**: Zero external framework packages will be added as runtime dependencies. All selected patterns will be natively adapted into our existing, hardened JavaScript/Node.js contract architecture.
