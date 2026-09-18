# FAZ 63 — Failure Fallback & Retry Amplification Report

## 1. Fallback Decision Engine
When a primary provider encounters a terminal or transient failure, the gateway evaluates the fallback candidate pre-designated by the routing engine.

```text
Primary Provider Failure
         ↓
Error Classification
         ↓
Non-retriable (401/403/Budget/Security/Capability) ──> Halt immediately (0 retries)
         ↓
Transient (Timeout / 5xx / Rate Limit) ──> Bounded Exponential Backoff Retries
         ↓
Max Retries Exceeded ──> Engage Fallback Provider
         ↓
Security Boundary Re-Verification (Fail-closed if fallback violates tier)
```

---

## 2. Retry Storm Defense
Permanent errors (`CREDENTIALS_UNCONFIGURED`, `SECURITY_BLOCKED`, `BUDGET_EXCEEDED`, `CAPABILITY_UNSUPPORTED`) execute **exactly 1 attempt** and never trigger retry amplification.
