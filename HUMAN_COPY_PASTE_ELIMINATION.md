# HUMAN COPY/PASTE ELIMINATION SPECIFICATION

**AI Development OS — ONLUNET ZEKA**  
**Document Version**: 1.0.0 (Authoritative)  
**Phase**: FAZ 38 — ARCHITECTURE-FIRST / SCOPE LOCK  
**Mandate**: `WHEN A MACHINE-TO-MACHINE PATH EXISTS, HUMAN COPY/PASTE IS FORBIDDEN`

---

## 1. Executive Summary

In human-orchestrated AI development, human developers spend up to 80% of their time acting as human message buses: copying prompts from ChatGPT/Claude, pasting them into terminal/Antigravity, copying test errors back to the model, and manually repeating the loop.

This specification details every current manual boundary, replaces it with a structured, typed machine contract, and defines the transition path to **zero human copy/paste**.

---

## 2. Comprehensive Elimination Matrix

| # | Current Manual Handoff (Human Copy/Paste) | Proposed Machine-to-Machine Boundary | Required Interface / Contract | Migration Order |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **User Task Prompting**: User opens chat UI, types prompt, copies suggested shell commands to terminal. | Direct API/CLI ingestion into `JobManager`. | `POST /api/jobs` `{ requestedBy, projectPath, prompt, budget }` | **Phase 1 (FAZ 38)** |
| **2** | **Advisory Context Assembly**: Human manually copies file snippets or pastes codebase paths into prompt. | Deterministic Relevance Selector auto-attaches bounded file contents. | `assembleAdvisoryContext({ taskText, workspace })` | *Implemented (FAZ 30/32)* |
| **3** | **Plan Handoff**: Human reads AI plan output, copies `planId` and commands into UI execute boxes. | Automated Plan Ingestion: AI Gateway returns structured proposal; Server freezes plan and automatically emits `RunSpec`. | `authoritativeActivePlan` auto-binds to active Job state. | **Phase 1 (FAZ 38)** |
| **4** | **Tool Execution Dispatch**: Human clicks "Run Command" or manually types `node --test ...` in terminal. | Supervised Worker Runner: Orchestrator passes `RunSpec` to local execution pipeline without UI click. | `runApplicationPipeline({ runSpec, policyEvaluator })` | **Phase 2 (FAZ 39)** |
| **5** | **File Mutation Transfer**: Human copies code block from AI markdown response and pastes into editor. | Structured File Mutation: Coder model emits JSON mutation chunk `{ file, content, expectedState }` applied directly. | `executeAuthorizedFileMutation({ targetPath, content, planId })` | *Implemented (FAZ 16)*; Automate trigger in **FAZ 40**. |
| **6** | **Test Output Forwarding**: Human copies terminal error trace, pastes into AI prompt: "Here is the error, fix it". | Automated Observation Ingestion: Runner captures `stdout`/`stderr`, extracts stack trace, and auto-generates Diagnostic Task. | `DiagnosticContext { failingTest, exitCode, stderr, diff }` | **Phase 3 (FAZ 40)** |
| **7** | **Fix Loop Re-prompting**: Human copies new AI fix suggestion, pastes into files, reruns tests manually. | Supervised Test-Diagnose-Fix Loop: Orchestrator automatically re-invokes Coder agent with diagnostic context up to `MAX_RETRIES`. | `evaluateAutonomousRetry({ task, errorSignature, budget })` | **Phase 3 (FAZ 40)** |
| **8** | **Inter-Agent Persona Handoff**: Human asks Claude for architecture, copies to DeepSeek for coding, copies to GPT for review. | Multi-Agent Orchestrator DAG: Outputs of Planner node feed directly as structured inputs into Coder node. | `OrchestrationPlan.taskDependencies` DAG execution. | **Phase 4 (FAZ 42/43)** |
| **9** | **Validation & Verification**: Human manually reviews diff and runs lint/typecheck before accepting change. | Automated Validation Pipeline: Execution of test suite, coverage check, and security scanner with frozen `Validation` contract. | `createValidationContract({ target, criteria, evidences })` | *Implemented (FAZ 12)*; Automate release gate in **FAZ 46**. |
| **10** | **Delivery Packaging**: Human copies files to release folder or runs build/tag scripts manually. | Delivery Engine: Verifies all validations pass, tags commit, and generates release bundle artifact automatically. | `DeliveryBundleContract { releaseId, commitHash, artifactHash }` | **Phase 5 (FAZ 46)** |

---

## 3. Data Contracts Eliminating Manual Handoffs

### 3.1 Eliminating Prompt Copy/Paste: The `RunSpec` Contract
Instead of a human crafting a prompt, the system compiles a typed `RunSpec`:
```typescript
interface RunSpec {
  jobId: string;
  taskId: string;
  agentRole: AgentRole;
  instructions: string;
  workingDirectory: string;
  allowedTools: string[];
  context: {
    relevantFiles: Array<{ relativePath: string; content: string }>;
    diagnostics?: {
      lastExitCode: number;
      stderr: string;
      failingTests: string[];
    };
  };
  budget: {
    timeoutMs: number;
    maxTokens: number;
  };
}
```

### 3.2 Eliminating Output Copy/Paste: The `RunResult` Contract
Instead of a human copying terminal logs, the runtime emits a structured `RunResult`:
```typescript
interface RunResult {
  jobId: string;
  taskId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'SECURITY_BLOCKED';
  exitCode: number;
  stdout: string;
  stderr: string;
  diffSummary: {
    filesModified: string[];
    insertions: number;
    deletions: number;
  };
  evidenceId: string;
  failureClassification?: 'SYNTAX' | 'ASSERTION' | 'TIMEOUT' | 'UNKNOWN';
}
```

---

## 4. Architectural Guarantee

```text
At no point in the target workflow does a human act as a data transport mechanism.
The human supervises via policy, inspects via observability dashboards,
and approves high-risk actions when requested by an explicit policy gate.
```
