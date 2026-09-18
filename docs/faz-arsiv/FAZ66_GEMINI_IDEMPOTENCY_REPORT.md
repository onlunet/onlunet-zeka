# FAZ 66 — Gemini Idempotency & Trace Deduplication Report

## 1. Keyed Execution Caching
- Execution pipeline indexes requests by `requestId` / `idempotencyKey`.
- Duplicate executions return cached proposals without invoking remote providers or incurring token costs.
- Duplicate responses retain `isDuplicate: true`, `proposalOnly: true`, `executionAuthorized: false`.
