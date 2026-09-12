# FAZ 64 — OpenAI Response Normalization Audit

## 1. Canonical Normalization Contract
All responses from OpenAI Chat Completions are strictly normalized into `ProviderInvocationResult`:
- `providerId`: `"openai"`
- `model`: string (e.g. `"gpt-4o-mini"`)
- `content`: parsed or string output
- `proposalOnly`: `true` (HARD INVARIANT)
- `executionAuthorized`: `false` (HARD INVARIANT)
- `usage`: token counts (`inputTokens`, `outputTokens`, `totalTokens`)
- `costUsd`: numeric estimated cost or `null`

## 2. Zero-Authority Invariant
- Under NO circumstance does an OpenAI raw response trigger execution.
- LLM outputs are treated as UNTRUSTED DATA proposals requiring downstream reviewer and verification admission.
