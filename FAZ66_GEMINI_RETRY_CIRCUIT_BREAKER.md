# FAZ 66 — Gemini Retry Policy & Circuit Breaker Report

## 1. Circuit Breaker Behavior
- States: `CLOSED`, `OPEN`, `HALF_OPEN`
- Threshold: 3 consecutive failures transitions circuit to `OPEN`.
- Cooldown: 5000ms before probing in `HALF_OPEN`.
- Fail-Closed: When `OPEN`, immediately blocks execution without calling provider.

## 2. Retry Policy
- Bounded retries (default max 2 retries).
- Exponential backoff with jitter on transient errors (HTTP 429, 503).
- Rate limit handling: Honors `retry-after` HTTP response header.
