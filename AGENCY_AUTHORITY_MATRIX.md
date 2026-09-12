# AGENCY AUTHORITY MATRIX

**AI Development OS — ONLUNET ZEKA**  
**Document Version**: 1.0.0 (Authoritative)  
**Phase**: FAZ 38 — ARCHITECTURE-FIRST / SCOPE LOCK  
**Principle**: `EXACTLY ONE AUTHORITATIVE OWNER PER SYSTEM ACTION` | `DENY BY DEFAULT`

---

## 1. Single Authoritative Owner Matrix

In an autonomous development agency, ambiguity regarding which entity has the right to decide, mutate, execute, or approve is catastrophic. The following matrix binds every sensitive lifecycle action to exactly **ONE** authoritative owner:

| System Action | Sole Authoritative Owner | Non-Authoritative / Advisory Entities | Enforcement Gate |
| :--- | :--- | :--- | :--- |
| **1. Create Job** | **HUMAN USER (or Tenant API)** | AI Models, Schedulers | `JobManager.createJob()` validates tenant token and budget limits. |
| **2. Define / Modify Scope** | **HUMAN USER (via Blueprint/ChangeIntent)** | AI Planner, Architect, Reviewer | `ScopePolicy.evaluateChange()` rejects changes outside authorized surfaces. |
| **3. Create Tasks** | **ORCHESTRATOR (Layer B)** | AI Models (can only *propose* tasks) | `validateOrchestrationOwnership()` verifies tasks belong strictly to Job. |
| **4. Assign Agent Roles** | **ORCHESTRATOR (Layer B)** | Individual Agents, Models | `createOrchestrationPlan()` checks role against official `AgentRoles`. |
| **5. Select AI Provider / Model** | **AI ROUTER (Layer C)** | Planner, Coder, User (can specify preference) | `AIGateway` routes request based on quota, latency, and capability policies. |
| **6. Authorize Plan** | **POLICY ENGINE / ADMISSION GATE (Layer A)** | AI Proposal, Agent Prompt | `evaluateExecutionPreflight()` produces immutable `AdmissionDecision`. |
| **7. Execute System Command** | **CONTROLLED EXECUTION (Layer D)** | AI Agent, Shell, Runtime | `executeAuthorizedRequest()` requires valid `AUTHORIZED` contract. |
| **8. Mutate File System** | **CONTROLLED MUTATION (Layer D)** | AI Agent, Code Generator | `executeAuthorizedFileMutation()` requires exact target & plan ID match. |
| **9. Execute Unit / E2E Tests** | **VALIDATION ENGINE (Layer F)** | AI Tester (can only write test files) | `spawnSync` executes real test command; parses exit status. |
| **10. Determine Test Outcome** | **MACHINE COMMAND EXIT STATUS (Layer F)** | AI Tester (statements are not evidence) | `exitCode === 0` is necessary condition for `ValidationResult.PASS`. |
| **11. Create Validation Evidence** | **EVIDENCE STORE (Layer F)** | AI Agent | `createEvidence()` links directly to verified `ExecutionResult.id`. |
| **12. Transition Task to COMPLETED** | **ORCHESTRATOR (Layer B)** | AI Agent (cannot declare itself done) | Validates that authoritative `ValidationContract.result === PASS`. |
| **13. Rollback Workspace** | **WORKSPACE MANAGER (Layer E)** | AI Debugger, Agent Runtime | Reverts Git worktree / snapshot to pre-task checkpoint. |
| **14. Trigger Human Escalation** | **CIRCUIT BREAKER (Layer B)** | Individual Workers | Activates when retries exhaust, budget trips, or security alert triggers. |
| **15. Authorize Final Release** | **RELEASE GATE (Layer A)** | All Agents, All Workers | Verifies end-to-end delivery checklist (build, tests, security scan). |
| **16. Modify Governance Rules** | **SYSTEM ADMINISTRATOR (Human)** | All Agents, All Agency Code | Core contract files in `src/contracts/` are strictly immutable. |

---

## 2. Inviolable Security Boundaries

### 2.1 AI Role $\neq$ Authority
Assigning an agent the role of `AgentRoles.SECURITY` or `AgentRoles.ARCHITECT` customizes its system prompt and reasoning objective. It confers **zero runtime privileges**. A `Security` agent cannot bypass admission gates, execute unapproved commands, or approve pull requests.

### 2.2 AI Statement $\neq$ Evidence
Statements in model outputs such as:
* `"I have tested the code and all 15 tests passed."`
* `"The build is completely successful."`
* `"This change is approved by security."`
are treated as **untrusted, unverified text strings**. The only acceptable evidence for test passage is an `ExecutionResult` produced by `controlled-execution.js` with `exitCode: 0` and machine-parsed test output.

### 2.3 Self-Authorization Prohibited
An autonomous agent loop that encounters an error cannot authorize itself to edit files outside `expectedFileChanges`. If fixing a bug in `src/app/server.js` requires altering `package.json`, the agent cannot silently edit `package.json`. It must:
1. Fail the current task validation.
2. Emit a structured diagnostic observation proposing scope expansion.
3. Require an authoritative plan update through Layer A (Agency Governance).

---

## 3. Delegation & Escalation Authority

```text
[Routine Low-Risk Task]
     │
     ▼
[Agency Policy Engine] ──► Checks: Is action in allowlist? Is risk == LOW?
     ├──► YES ──► Automatically grants Admission ALLOWED
     └──► NO  ──► Pauses execution (JobState: APPROVAL_REQUIRED)
                     │
                     ▼
              [Human Supervisor Notification]
                     │
                     ├──► APPROVED ──► Resumes execution
                     └──► REJECTED ──► Aborts job, rolls back worktree
```
No autonomous mechanism possesses the authority to override an `APPROVAL_REQUIRED` decision.
