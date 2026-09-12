# FAZ 65 — Real-World Task Routing Report

## 1. Task Archetype Evaluation
| Task Archetype | Sample Input | Inferred Task Type | Inferred Capabilities | Selected Provider |
|---|---|---|---|---|
| **GENERAL_QA** | "Türkiye'nin başkenti nedir?" | `GENERAL_QA` | `[TEXT]` | `local` |
| **CODING** | "JavaScript array max function" | `CODING` | `[TEXT, STRUCTURED_OUTPUT]` | `local` |
| **CODE_REVIEW** | "Security audit inspection" | `CODE_REVIEW` | `[TEXT, STRUCTURED_OUTPUT]` | `local` |
| **REASONING** | "Compare project costs and risks" | `REASONING` | `[TEXT, REASONING]` | `local` |
| **STRUCTURED_OUTPUT** | "Return JSON schema" | `STRUCTURED_GENERATION` | `[TEXT, STRUCTURED_OUTPUT, JSON_MODE]` | `local` |
| **SECURITY** | "Process secret database credentials" | `GENERAL_QA` (`SECRET`) | `[TEXT]` | `local` (Cloud Blocked) |

## 2. Explainability
Every routing decision provides full audit trail:
- `reasons`: List of criteria satisfied.
- `rejectedCandidates`: Explicit reasons why candidates were filtered or ranked lower.
