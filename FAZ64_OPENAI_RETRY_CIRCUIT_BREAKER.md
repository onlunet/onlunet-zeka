# FAZ 64 — OpenAI Retry Policy & Circuit Breaker Audit

## 1. Bounded Retry Policy
- **Maximum Retries**: 2 attempts
- **Backoff**: Exponential backoff with jitter
- **Retry-After Header**: Parsed and respected for HTTP 429
- **Non-Retriable Errors**:
  - 401 Unauthorized / `AUTHENTICATION_FAILED` (0 retries)
  - 403 Forbidden / `PERMISSION_DENIED` (0 retries)
  - 400 Bad Request / Invalid schema (0 retries)
  - `CREDENTIALS_UNCONFIGURED` (0 retries)

## 2. Circuit Breaker Lifecycle
- **Failure Threshold**: 3 consecutive errors
- **States**: `CLOSED` -> `OPEN` (fast-fail closed) -> `HALF_OPEN` (probe)
- When circuit is `OPEN`, requests fast-fail with `CIRCUIT_OPEN` without generating outbound network sockets.
