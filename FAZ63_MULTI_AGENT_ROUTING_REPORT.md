# FAZ 63 — Multi-Agent Live Routing Report

## 1. Role-Based Routing Matrix
FAZ 63 introduces the **Agent Router** (`src/providers/agent-router.js`) which tailors routing decisions to each agent's functional role:

| Agent Role | Required Capabilities | Quality Target | Target Model Profile |
|---|---|---|---|
| **ANALYSIS** | TEXT, REASONING | HIGH | Frontier Reasoning Model |
| **VERIFICATION**| TEXT, REASONING, STRUCTURED_OUTPUT | CRITICAL | High Precision Schema Model |
| **SYNTHESIS** | TEXT, STRUCTURED_OUTPUT | HIGH | Synthesis / Summarization Model |
| **DEVELOPER** | TEXT, STRUCTURED_OUTPUT | MEDIUM | Code Generation Engine |
| **SECURITY_AUDITOR** | TEXT, REASONING, STRUCTURED_OUTPUT | CRITICAL | Formal Security Analysis Engine |

---

## 2. Zero Self-Authority Invariant
All multi-agent routing decisions output:
```javascript
{
  proposalOnly: true,
  executionAuthorized: false
}
```
No agent or pipeline can authorize execution, mutate code, or bypass human review gates.
