# FAZ 65 — Failure Injection & Resilience Report

## 1. Evaluated Scenarios (14 Vectors)
All 14 failure injection scenarios fail closed safely:
1. Empty task -> `FAILED` (Empty task provided)
2. Zero budget -> `BUDGET_EXCEEDED`
3. Negative budget -> `BUDGET_EXCEEDED`
4. Unconfigured cloud provider -> Graceful fallback to local / `NOT_CONFIGURED`
5. Invalid JSON -> `VERIFICATION_FAILED`
6. Dangerous code constructs -> `VERIFICATION_FAILED`
7. Missing tenant credentials -> `SECURITY_BLOCKED`
8. Tenant mismatch -> `SECURITY_BLOCKED`
9. Timeout -> AbortController cancellation
10. 401 Auth error -> Non-retriable failure
11. 429 Rate limit -> Retry-after honored
12. 500 Server error -> Bounded retry / fallback
13. Circuit breaker open -> Fast-fail closed
14. Exceeded self-correction cycles -> Terminate at cycle 3
