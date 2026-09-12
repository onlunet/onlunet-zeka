# FAZ 66 — Gemini Failure Modes & Error Mapping Report

## Error Code Mapping
| HTTP Status | Error Code | Description |
|---|---|---|
| 401 | `AUTHENTICATION_FAILED` | Invalid or missing API key |
| 403 | `PERMISSION_DENIED` | Restricted project or unauthenticated quota |
| 429 | `RATE_LIMITED` | Quota or rate limit exceeded; extracts `retryAfter` |
| 500 / 503 | `SERVER_ERROR` | Remote Google service temporary failure |
| Abort / Timeout | `TIMEOUT` | Call exceeded configured timeoutMs (status 408) |
| Non-JSON | `PROVIDER_INVALID_RESPONSE` | Remote service returned malformed payload |
