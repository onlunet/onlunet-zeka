# FAZ 66 — Gemini Observability & Telemetry Report

## 1. Structured Metrics Emitted
- `providerId`: gemini / google
- `model`: gemini-1.5-flash / gemini-1.5-pro / gemini-2.0-flash
- `latencyMs`: Measured wall-clock duration of network call
- `usage`: Input, output, and total token accounting
- `cost`: USD cost breakdown
- `finishReason`: STOP, MAX_TOKENS, SAFETY, etc.

## 2. Audit Trail Sanitization
- All telemetry logs pass through credential sanitizer before persistence.
