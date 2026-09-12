# FAZ 59 AUTONOMOUS AI AGENCY EXECUTION WORKFLOW

**System**: ONLUNET ZEKA Architectural Core  
**Guide**: Autonomous Agency Execution Lifecycle Walkthrough  
**Phase**: FAZ 59  
**Security Invariant**:  
`AI ≠ AUTHORITY | AGENT ≠ AUTHORITY | PROVIDER ≠ AUTHORITY | PROPOSAL ≠ AUTHORITY | CONFIDENCE ≠ AUTHORITY | CONSENSUS ≠ AUTHORITY | AI APPROVAL ≠ APPROVAL | AI VERIFICATION ≠ VERIFICATION | AI COMPLETION ≠ COMPLETION`

---

## Overview

This guide details the end-to-end execution lifecycle of the **Autonomous AI Agency Execution Loop** introduced in FAZ 59. It demonstrates how a high-level project requirement moves through the deterministic 10-phase pipeline, through self-correction and auto-repair, all the way to a verified delivery package.

---

## 1. Step-by-Step Execution Lifecycle

```text
 USER COMMAND
      │
      ▼
 [Phase 1] PROJECT UNDERSTANDING
      │    └── analyzeProjectWorkspace(): scans package.json, tests, runtime
      ▼
 [Phase 2] IMPLEMENTATION PLANNING
      │    └── Builds structured plan: goal, steps, acceptance criteria
      ▼
 [Phase 3] ARCHITECTURE REVIEW
      │    └── Validates boundaries, interfaces, and component cohesion
      ▼
 [Phase 4] IMPLEMENTATION (MULTI-AGENT PROPOSALS)
      │    └── Specialized agents (Developer, Security) generate proposals
      ▼
 [Phase 5] GOVERNANCE ADMISSION & CONTROLLED BRIDGE
      │    └── Proposal Review -> Explicit Approval -> Admission -> Bridge Executed
      ▼
 [Phase 6] TEST EXECUTION & EVIDENCE CAPTURE
      │    └── Runs real testRunner; captures exitCode, stdout, stderr, timing
      │
      ├─────────────────────── If Tests Pass (exitCode === 0) ──────────────────────┐
      │                                                                             │
      ▼ (If Tests Fail: exitCode !== 0)                                             │
 [Phase 7] BOUNDED AUTO-REPAIR LOOP (MAX 3 ATTEMPTS)                                │
      ├── Failure Diagnosis (failure-analyzer.js: category, root cause, files)       │
      ├── Targeted Patch Proposal (proposes minimal fix for affected file)          │
      ├── Governance Admission Bridge (task-[jobId]-fix-[attempt])                  │
      ├── Step 7a: Run Targeted Test First                                          │
      │    ├── If Fails: Skip regression, record failure, loop or trip to BLOCKED   │
      │    └── If Passes: Proceed to Step 7b                                        │
      └── Step 7b: Run Full Regression Test Second                                  │
           ├── If Fails: Record failure, loop or trip to BLOCKED                    │
           └── If Passes: Repair Succeeded! Transition to RETESTING                 │
                                                                                    │
      ┌─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
 [Phase 8] POST-EXECUTION REVIEWS
      └── CodeReviewAgent & SecurityReviewAgent verify changes & sanitize secrets
      ▼
 [Phase 9] DETERMINISTIC VERIFICATION GATE
      └── Invariants verified: Real files, real test evidence, 0 exit code, policy
      ▼
 [Phase 10] DELIVERY PACKAGE ASSEMBLY
      └── Status: READY_FOR_DELIVERY (Immutable package with full audit trail)
```

---

## 2. Walkthrough Example: Building an Analytics Endpoint

### Step 1: Submitting the Job via HTTP
An operator or API client submits a project command:

```http
POST /api/autonomous/jobs HTTP/1.1
Host: localhost:3000
Content-Type: application/json
X-Tenant-Id: tenant-prod

{
  "userRequest": "Implement GET /api/v1/analytics summary endpoint with cache",
  "workspaceId": "workspace-main",
  "idempotencyKey": "req-analytics-20260905-01",
  "limits": {
    "maxIterations": 10,
    "maxFixAttempts": 3,
    "maxProviderCalls": 15,
    "maxCostUsd": 2.00
  }
}
```

Response:
```json
{
  "success": true,
  "jobId": "job-a482b861-55ff-437a-9cf7-4f1dc0981a52",
  "status": "ANALYZING",
  "phase": "PROJECT_ANALYSIS",
  "metrics": {
    "iterations": 0,
    "fixAttempts": 0,
    "providerCalls": 0,
    "tokensUsed": 0,
    "costUsd": 0.0
  }
}
```

---

### Step 2: Project Understanding (Phase 1)
The engine calls `analyzeProjectWorkspace({ workspaceRoot: '...' })`.
- Inspects `package.json` (strips UTF-8 BOM if present).
- Detects test framework (`node:test`).
- Discovers 124 existing test suites.
- Emits event: `PROJECT_ANALYSIS_COMPLETED`.

---

### Step 3: Planning & Architecture (Phases 2 & 3)
The engine queries the `ARCHITECT` agent via the `ProviderGateway` (OpenAI, Anthropic, Gemini, or Local):
- Generates structured steps:
  1. Create `src/analytics/summary.js`.
  2. Register endpoint in `src/app/server.js`.
  3. Create test in `tests/analytics-summary.test.js`.
- Architectural review verifies no cyclic dependencies or breaking changes.
- Emits events: `PLAN_CREATED`, `ARCHITECTURE_REVIEW_COMPLETED`.

---

### Step 4: Implementation Proposal (Phase 4)
The `DEVELOPER` specialist agent proposes file operations:
- Operation 1: `CREATE` `src/analytics/summary.js`.
- Security scanner validates target file paths (rejects `..`, null bytes, absolute paths).
- Proposal authority guarantee explicitly set to `proposalOnly: true, executionAuthorized: false`.

---

### Step 5: Governance Admission & Controlled Execution (Phase 5)
1. `aggregateAndReviewProposals()` validates team roles and operations (`status: REVIEWED`).
2. `createApprovalRecord()` creates an immutable record from `SYSTEM_POLICY` or human approver. AI models are strictly blocked from approving (`AI ≠ APPROVAL`).
3. `evaluateApprovalAdmission()` checks approval validity, TTL, and cryptographic fingerprints (`status: ADMISSION_ALLOWED`).
4. `executeAdmittedBridge()` checks single-execution invariant, confirms workspace root, and applies file mutations via `jobEngine`.

---

### Step 6: Real Test Execution & Auto-Repair (Phases 6 & 7)

#### Scenario A: Initial Tests Pass
- `testRunner` executes `node --test tests/analytics-summary.test.js`.
- Captured output: `exitCode: 0`, `stdout: '10 tests pass'`.
- Phase 7 auto-repair is skipped. Proceeds directly to Phase 8.

#### Scenario B: Initial Tests Fail (Auto-Repair Triggered)
- `testRunner` exits with code `1`:
  ```text
  AssertionError: Expected { cached: true } but got { cached: false }
  ```
- **Phase 7 Auto-Repair Loop activates**:
  1. `analyzeTestFailure()` classifies error as `ASSERTION_FAILURE` with confidence `0.95`. Identifies `src/analytics/summary.js` as the affected file.
  2. `AutoRepairController` generates a minimal fix proposal targeting `src/analytics/summary.js`.
  3. Governance pipeline evaluates and admits the repair under a fresh task ID: `task-job-123-fix-1`.
  4. Execution bridge applies the fix.
  5. **Targeted Test First**: Runs only `tests/analytics-summary.test.js`.
     - Result: `exitCode: 0` (PASS).
  6. **Full Regression Test Second**: Runs the entire test suite (`npm test`).
     - Result: `exitCode: 0` (PASS).
  7. Auto-repair records outcome: `{ status: 'REPAIRED', attempt: 1, success: true }`.
  8. Job transitions to `RETESTING`.

---

### Step 7: Reviews & Deterministic Verification Gate (Phases 8 & 9)
1. `SECURITY_REVIEW`: Ensures zero secret leakage and verifies code safety.
2. `VERIFYING`: Checks all five deterministic verification invariants:
   - `IMPLEMENTATION_EXISTS: true`
   - `TESTS_EXECUTED: true`
   - `TESTS_PASSED: true`
   - `SECURITY_PASSED: true`
   - `POLICY_SATISFIED: true`

---

### Step 8: Ready for Delivery (Phase 10)
The engine transitions to `READY_FOR_DELIVERY` and seals the delivery package:

```http
GET /api/autonomous/jobs/job-a482b861-55ff-437a-9cf7-4f1dc0981a52/result HTTP/1.1
Host: localhost:3000
```

Response:
```json
{
  "status": "READY_FOR_DELIVERY",
  "jobId": "job-a482b861-55ff-437a-9cf7-4f1dc0981a52",
  "changedFiles": ["src/analytics/summary.js"],
  "testsPassed": true,
  "regressionPassed": true,
  "securityPassed": true,
  "verificationPassed": true,
  "iterations": 1,
  "providerUsage": {
    "calls": 3,
    "tokens": 820
  },
  "cost": {
    "totalUsd": 0.0082,
    "currency": "USD"
  },
  "deliveredAt": "2026-09-05T12:47:12.800Z"
}
```

---

## 3. Handling Failure & Boundary Scenarios

### Persistent Failure (Trip to BLOCKED)
If an unfixable bug causes tests to fail across all 3 attempts:
1. Attempt 1: Fix applied -> Targeted test fails.
2. Attempt 2: Fix applied -> Targeted test fails.
3. Attempt 3: Fix applied -> Targeted test fails.
4. Attempt limit reached (`maxFixAttempts = 3`).
5. **State Transition**: Job transitions to `BLOCKED` (`isTerminal: false`).
6. **Resumption**: A human developer inspects the failure events via `GET /api/autonomous/jobs/:jobId/events`, fixes the ambiguity, and calls `POST /api/autonomous/jobs/:jobId/resume` to resume execution without data loss.

### Budget & Timeout Trip
- If cumulative tokens exceed `maxTokens` (100,000) -> Transitions immediately to `BUDGET_EXCEEDED` (terminal).
- If execution exceeds `maxElapsedTimeMs` (5 min) -> Transitions immediately to `TIMEOUT` (terminal).
- If an operator calls `POST /api/autonomous/jobs/:jobId/cancel` -> Execution aborts immediately via `AbortSignal` -> Transitions to `CANCELLED` (terminal).

---

## 4. Summary of Verification Invariants

| Action | Authority Rule |
| :--- | :--- |
| **AI Proposal** | Inert text only. Cannot touch disk without passing through the admission gate. |
| **AI Approval** | Forbidden. Approvals must come from `SYSTEM_POLICY` or human operators. |
| **AI Verification** | Zero value. Completion strictly requires `exitCode === 0` from real processes. |
| **Auto-Repair Loop** | Hard limit of 3 attempts. Targeted test must pass before regression runs. |
| **Secret Redaction** | All event payloads and log messages scrubbed of sensitive tokens. |
